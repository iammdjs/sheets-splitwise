/**
 * Parses the split details string based on SplitType.
 * @param {string} splitDetails - Comma-separated list of emails or email:amount pairs
 * @param {string} splitType - 'EQUAL' or 'EXACT'
 * @param {Array<string>} allMemberEmails - Fallback emails list if details is empty for EQUAL
 * @returns {Object} Mapping of email -> share amount
 */
export function parseSplitDetails(splitDetails, splitType, allMemberEmails = []) {
  const splits = {};
  
  if (!splitDetails || splitDetails.trim() === '') {
    if (splitType === 'EQUAL') {
      const share = 1 / Math.max(1, allMemberEmails.length);
      allMemberEmails.forEach(email => {
        splits[email] = share; // represented as proportion initially
      });
    }
    return splits;
  }

  const parts = splitDetails.split(',').map(s => s.trim());

  if (splitType === 'EQUAL') {
    const share = 1 / Math.max(1, parts.length);
    parts.forEach(email => {
      if (email) splits[email] = share; // proportion
    });
  } else if (splitType === 'EXACT') {
    parts.forEach(part => {
      const [email, amountStr] = part.split(':');
      if (email && amountStr) {
        const amt = parseFloat(amountStr);
        if (!isNaN(amt)) {
          splits[email.trim()] = amt; // exact amount
        }
      }
    });
  }

  return splits;
}

/**
 * Calculates net balances, total spend, and user breakdown for a group.
 * @param {Array<Object>} expenses - List of expenses
 * @param {Array<Object>} members - List of group members
 * @returns {Object} Balances summary
 */
export function calculateBalances(expenses, members) {
  const memberEmails = members.map(m => m.Email.toLowerCase());
  const netBalances = {};
  const totalSpends = {};
  const owes = {};
  
  // Initialize
  memberEmails.forEach(email => {
    netBalances[email] = 0;
    totalSpends[email] = 0;
    owes[email] = 0;
  });

  let totalGroupSpend = 0;

  expenses.forEach(expense => {
    const amount = parseFloat(expense.Amount);
    if (isNaN(amount) || amount <= 0) return;

    totalGroupSpend += amount;
    const paidBy = expense.PaidBy.toLowerCase();
    
    // Add to paidBy's total spend
    if (totalSpends[paidBy] !== undefined) {
      totalSpends[paidBy] += amount;
    } else {
      totalSpends[paidBy] = amount;
    }

    // Add to paidBy's net balance initially
    if (netBalances[paidBy] !== undefined) {
      netBalances[paidBy] += amount;
    } else {
      netBalances[paidBy] = amount;
    }

    // Calculate who owes what
    const splits = parseSplitDetails(expense.SplitDetails, expense.SplitType, memberEmails);
    
    if (expense.SplitType === 'EQUAL') {
      const emailsInvolved = Object.keys(splits);
      const shareAmount = amount / Math.max(1, emailsInvolved.length);
      
      emailsInvolved.forEach(email => {
        const e = email.toLowerCase();
        if (owes[e] !== undefined) {
          owes[e] += shareAmount;
        } else {
          owes[e] = shareAmount;
        }

        if (netBalances[e] !== undefined) {
          netBalances[e] -= shareAmount;
        } else {
          netBalances[e] = -shareAmount;
        }
      });
    } else if (expense.SplitType === 'EXACT') {
      Object.entries(splits).forEach(([email, shareAmount]) => {
        const e = email.toLowerCase();
        if (owes[e] !== undefined) {
          owes[e] += shareAmount;
        } else {
          owes[e] = shareAmount;
        }

        if (netBalances[e] !== undefined) {
          netBalances[e] -= shareAmount;
        } else {
          netBalances[e] = -shareAmount;
        }
      });
    }
  });

  return {
    netBalances,
    totalSpends,
    owes,
    totalGroupSpend
  };
}

/**
 * Greedy algorithm to simplify debts and find the minimum transaction set.
 * @param {Object} netBalances - Dictionary of email -> netBalance
 * @returns {Array<Object>} List of transactions: { from, to, amount }
 */
export function simplifyDebts(netBalances) {
  const debtors = [];
  const creditors = [];

  // Separate debtors and creditors
  Object.entries(netBalances).forEach(([email, balance]) => {
    // Round to 2 decimal places to handle floating point issues
    const roundedBalance = Math.round(balance * 100) / 100;
    if (roundedBalance < 0) {
      debtors.push({ email, amount: Math.abs(roundedBalance) });
    } else if (roundedBalance > 0) {
      creditors.push({ email, amount: roundedBalance });
    }
  });

  const transactions = [];

  // Greedily match largest debtor and largest creditor
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort descending by amount
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const settleAmount = Math.min(debtor.amount, creditor.amount);
    
    if (settleAmount > 0.01) {
      transactions.push({
        from: debtor.email,
        to: creditor.email,
        amount: Math.round(settleAmount * 100) / 100
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) {
      debtors.shift();
    }
    if (creditor.amount < 0.01) {
      creditors.shift();
    }
  }

  return transactions;
}
