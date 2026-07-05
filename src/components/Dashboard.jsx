import React, { useState, useMemo } from 'react';
import { 
  Plus, Trash2, UserPlus, Share2, RefreshCw, 
  TrendingUp, TrendingDown, DollarSign, X, 
  ChevronRight, Calendar, Coffee, Home, Car, 
  Gift, FileText, CheckCircle, ArrowRight, Edit3
} from 'lucide-react';
import { calculateBalances, simplifyDebts } from '../utils/balanceCalculator';

const currencySymbols = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$'
};

const getCurrencySymbol = (currencyCode) => {
  return currencySymbols[currencyCode?.toUpperCase()] || currencyCode || '₹';
};

// Helper to return a category icon
const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case 'food': return <Coffee size={18} />;
    case 'rent': return <Home size={18} />;
    case 'transport': return <Car size={18} />;
    case 'entertainment': return <Gift size={18} />;
    default: return <FileText size={18} />;
  }
};

export default function Dashboard({ 
  data, 
  activeUser, 
  spreadsheetId,
  onAddExpense, 
  onEditExpense,
  onDeleteExpense, 
  onAddMember, 
  onShareSheet,
  onRefresh,
  isSyncing 
}) {
  const { config, members, expenses } = data;

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form states - Expense
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePayer, setExpensePayer] = useState(activeUser.email);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('General');
  const [expenseSplitType, setExpenseSplitType] = useState('EQUAL');
  
  // Custom split checkboxes & amounts
  const [splitShares, setSplitShares] = useState(
    members.reduce((acc, m) => ({ ...acc, [m.Email.toLowerCase()]: { checked: true, amount: '' } }), {})
  );

  // Form states - Member
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [shareOnInvite, setShareOnInvite] = useState(true);

  // Form states - Share
  const [shareEmail, setShareEmail] = useState('');
  const [shareSuccessMsg, setShareSuccessMsg] = useState('');

  // Form states - Settle Up
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);

  // Calculations
  const calculations = useMemo(() => {
    return calculateBalances(expenses, members);
  }, [expenses, members]);

  const settlements = useMemo(() => {
    return simplifyDebts(calculations.netBalances);
  }, [calculations.netBalances]);

  // Current user's balance info
  const myEmail = activeUser.email.toLowerCase();
  const myBalance = calculations.netBalances[myEmail] || 0;
  const myTotalSpend = calculations.totalSpends[myEmail] || 0;
  const myOwed = calculations.owes[myEmail] || 0;

  // Open modals handlers
  const openExpenseModal = () => {
    // Reset state & prep split checkboxes
    setEditingExpense(null);
    setExpenseDesc('');
    setExpenseAmount('');
    setExpensePayer(myEmail);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseCategory('General');
    setExpenseSplitType('EQUAL');
    setSplitShares(
      members.reduce((acc, m) => ({ ...acc, [m.Email.toLowerCase()]: { checked: true, amount: '' } }), {})
    );
    setSubmitError('');
    setIsExpenseModalOpen(true);
  };

  const openEditExpenseModal = (expense) => {
    setEditingExpense(expense);
    setExpenseDesc(expense.Description);
    setExpenseAmount(expense.Amount);
    setExpensePayer(expense.PaidBy.toLowerCase());
    setExpenseDate(expense.Date);
    setExpenseCategory(expense.Category || 'General');
    setExpenseSplitType(expense.SplitType || 'EQUAL');

    // Parse existing SplitDetails
    const details = expense.SplitDetails || '';
    const initialShares = {};

    if (expense.SplitType === 'EQUAL') {
      const selectedEmails = details ? details.split(',').map(e => e.trim().toLowerCase()) : [];
      members.forEach(m => {
        const email = m.Email.toLowerCase();
        initialShares[email] = {
          checked: selectedEmails.length === 0 ? true : selectedEmails.includes(email),
          amount: ''
        };
      });
    } else if (expense.SplitType === 'EXACT') {
      const parts = details ? details.split(',') : [];
      const amountsMap = {};
      parts.forEach(part => {
        const [email, amountStr] = part.split(':');
        if (email && amountStr) {
          amountsMap[email.trim().toLowerCase()] = amountStr;
        }
      });

      members.forEach(m => {
        const email = m.Email.toLowerCase();
        initialShares[email] = {
          checked: true,
          amount: amountsMap[email] || ''
        };
      });
    }

    setSplitShares(initialShares);
    setSubmitError('');
    setIsExpenseModalOpen(true);
  };

  const openMemberModal = () => {
    setMemberName('');
    setMemberEmail('');
    setSubmitError('');
    setIsMemberModalOpen(true);
  };

  const openShareModal = () => {
    setShareEmail('');
    setShareSuccessMsg('');
    setSubmitError('');
    setIsShareModalOpen(true);
  };

  const openSettleModal = () => {
    setSettleFrom(myEmail);
    const firstOther = members.find(m => m.Email.toLowerCase() !== myEmail);
    setSettleTo(firstOther ? firstOther.Email.toLowerCase() : '');
    setSettleAmount('');
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSubmitError('');
    setIsSettleModalOpen(true);
  };

  const openSettleModalWithDetails = (fromEmail, toEmail, amount) => {
    setSettleFrom(fromEmail.toLowerCase());
    setSettleTo(toEmail.toLowerCase());
    setSettleAmount(amount.toString());
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSubmitError('');
    setIsSettleModalOpen(true);
  };

  // Submit handlers
  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setSubmitError('Please enter a valid amount.');
      return;
    }

    if (!expenseDesc.trim()) {
      setSubmitError('Please enter a description.');
      return;
    }

    setSubmitLoading(true);

    let splitDetails = '';
    if (expenseSplitType === 'EQUAL') {
      const selectedEmails = Object.keys(splitShares).filter(email => splitShares[email].checked);
      if (selectedEmails.length === 0) {
        setSubmitError('Please select at least one person to split with.');
        setSubmitLoading(false);
        return;
      }
      splitDetails = selectedEmails.join(',');
    } else {
      // EXACT split validation
      let sumOfSplits = 0;
      const splitParts = [];
      
      for (const m of members) {
        const email = m.Email.toLowerCase();
        const splitVal = parseFloat(splitShares[email]?.amount || 0);
        if (splitVal > 0) {
          sumOfSplits += splitVal;
          splitParts.push(`${email}:${splitVal}`);
        }
      }

      // Check floating point accuracy (within 0.02)
      if (Math.abs(sumOfSplits - amt) > 0.02) {
        const symbol = getCurrencySymbol(config.Currency);
        setSubmitError(`The sum of exact splits (${symbol}${sumOfSplits.toFixed(2)}) must equal the total amount (${symbol}${amt.toFixed(2)}).`);
        setSubmitLoading(false);
        return;
      }

      splitDetails = splitParts.join(',');
    }

    try {
      if (editingExpense) {
        await onEditExpense({
          id: editingExpense.ID || editingExpense.id,
          description: expenseDesc.trim(),
          amount: amt,
          paidBy: expensePayer,
          splitType: expenseSplitType,
          splitDetails,
          date: expenseDate,
          category: expenseCategory
        });
      } else {
        await onAddExpense({
          id: crypto.randomUUID(),
          description: expenseDesc.trim(),
          amount: amt,
          paidBy: expensePayer,
          splitType: expenseSplitType,
          splitDetails,
          date: expenseDate,
          category: expenseCategory,
          createdBy: myEmail
        });
      }
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save expense.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    
    if (!memberName.trim() || !memberEmail.trim()) {
      setSubmitError('All fields are required.');
      return;
    }

    setSubmitLoading(true);

    try {
      const emailLower = memberEmail.trim().toLowerCase();
      // 1. Add as member in the sheet
      await onAddMember({
        name: memberName.trim(),
        email: emailLower
      });

      // 2. Also share spreadsheet if checked
      if (shareOnInvite) {
        await onShareSheet(emailLower);
      }

      setIsMemberModalOpen(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to add member.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setSubmitError('Please enter a valid amount.');
      return;
    }

    if (settleFrom === settleTo) {
      setSubmitError('Payer and Recipient must be different members.');
      return;
    }

    setSubmitLoading(true);

    try {
      const fromName = getMemberName(settleFrom);
      const toName = getMemberName(settleTo);

      await onAddExpense({
        id: crypto.randomUUID(),
        description: `Settle Up: ${fromName} paid ${toName}`,
        amount: amt,
        paidBy: settleFrom,
        splitType: 'EXACT',
        splitDetails: `${settleTo}:${amt}`,
        date: settleDate,
        category: 'Payment',
        createdBy: myEmail
      });

      setIsSettleModalOpen(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to record payment.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setShareSuccessMsg('');

    if (!shareEmail.trim()) {
      setSubmitError('Email address is required.');
      return;
    }

    setSubmitLoading(true);

    try {
      await onShareSheet(shareEmail.trim().toLowerCase());
      setShareSuccessMsg(`Spreadsheet successfully shared with ${shareEmail}! They will receive an email invite.`);
      setShareEmail('');
    } catch (err) {
      setSubmitError(err.message || 'Failed to share spreadsheet.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteExpenseClick = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await onDeleteExpense(expenseId);
      } catch (err) {
        alert(err.message || 'Failed to delete expense.');
      }
    }
  };

  // Helper formatting currencies
  const formatCurrency = (val) => {
    const rounded = Math.round(val * 100) / 100;
    const symbol = getCurrencySymbol(config.Currency);
    return `${symbol}${rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getMemberName = (email) => {
    const member = members.find(m => m.Email.toLowerCase() === email.toLowerCase());
    return member ? member.Name : email;
  };

  return (
    <div className="main-content">
      {/* Top Banner / Header */}
      <div className="dashboard-header">
        <div className="group-title-wrapper">
          <h2>{config.GroupName || 'My Splitwise Group'}</h2>
          <div className="group-meta">
            <span>Currency: <strong>{config.Currency || 'USD'}</strong></span>
            <span>•</span>
            <span>Members: <strong>{members.length}</strong></span>
            {isSyncing && (
              <>
                <span>•</span>
                <span style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <RefreshCw size={12} className="spinner" /> Syncing with sheet...
                </span>
              </>
            )}
          </div>
        </div>

        <div className="btn-group">
          <button className="btn-secondary" onClick={onRefresh} disabled={isSyncing}>
            <RefreshCw size={16} className={isSyncing ? 'spinner' : ''} />
            <span>Sync</span>
          </button>
          <button className="btn-secondary" onClick={openShareModal}>
            <Share2 size={16} />
            <span>Share Group</span>
          </button>
          <button className="btn-secondary" onClick={openSettleModal}>
            <span>Settle Up</span>
          </button>
          <button className="btn-primary" onClick={openExpenseModal}>
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card glass-panel">
          <div className="summary-card-header">
            <span>TOTAL GROUP SPEND</span>
            <DollarSign size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="summary-amount neutral">{formatCurrency(calculations.totalGroupSpend)}</div>
        </div>

        <div className="summary-card glass-panel">
          <div className="summary-card-header">
            <span>YOUR TOTAL SPENT</span>
            <TrendingUp size={16} style={{ color: 'var(--success-color)' }} />
          </div>
          <div className="summary-amount neutral">{formatCurrency(myTotalSpend)}</div>
        </div>

        <div className="summary-card glass-panel">
          <div className="summary-card-header">
            <span>YOUR BALANCE</span>
            {myBalance > 0 ? (
              <TrendingUp size={16} style={{ color: 'var(--success-color)' }} />
            ) : myBalance < 0 ? (
              <TrendingDown size={16} style={{ color: 'var(--danger-color)' }} />
            ) : (
              <DollarSign size={16} style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
          <div className={`summary-amount ${myBalance > 0 ? 'credit' : myBalance < 0 ? 'debt' : 'neutral'}`}>
            {myBalance > 0 ? '+' : ''}{formatCurrency(myBalance)}
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="dashboard-grid">
        {/* Left Side: Expense List */}
        <div className="section-panel glass-panel">
          <div className="panel-header">
            <h3>Expenses Log</h3>
          </div>

          <div className="expense-list">
            {expenses.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} className="empty-state-icon" />
                <h4>No Expenses Yet</h4>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Click "Add Expense" to record your group's first split!</p>
              </div>
            ) : (
              // Show newest expenses first
              [...expenses].reverse().map(exp => {
                const paidByMe = exp.PaidBy.toLowerCase() === myEmail;
                return (
                  <div key={exp.ID} className="expense-item">
                    <div className="expense-left">
                      <div className="category-icon-wrapper">
                        {getCategoryIcon(exp.Category)}
                      </div>
                      <div className="expense-details">
                        <span className="expense-desc">{exp.Description}</span>
                        <span className="expense-meta-info">
                          Paid by <strong>{paidByMe ? 'You' : getMemberName(exp.PaidBy)}</strong> on {exp.Date}
                        </span>
                      </div>
                    </div>

                    <div className="expense-right">
                      <div className="expense-pricing">
                        <span className="expense-amount-paid">{formatCurrency(parseFloat(exp.Amount))}</span>
                        <div className="expense-split-type">Split: {exp.SplitType}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button 
                          className="edit-icon-btn" 
                          onClick={() => openEditExpenseModal(exp)}
                          title="Edit expense"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          className="delete-btn" 
                          onClick={() => handleDeleteExpenseClick(exp.ID)}
                          title="Delete expense"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Balances and Settlements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Settle Up Wizard */}
          <div className="section-panel glass-panel">
            <div className="panel-header">
              <h3>Settle Up Suggestions</h3>
            </div>
            
            <div className="settlement-list">
              {settlements.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <CheckCircle size={36} style={{ color: 'var(--success-color)', marginBottom: '0.75rem' }} />
                  <h4 style={{ color: 'var(--text-primary)' }}>Everyone is Settled!</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No payments are currently outstanding.</p>
                </div>
              ) : (
                settlements.map((settle, idx) => {
                  const fromMe = settle.from === myEmail;
                  const toMe = settle.to === myEmail;
                  
                  return (
                    <div key={idx} className="settlement-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="settlement-flow" style={{ flex: 1 }}>
                        <span className="settle-name" style={{ color: fromMe ? 'var(--primary-color)' : 'inherit', fontWeight: fromMe ? 700 : 500 }}>
                          {fromMe ? 'You' : getMemberName(settle.from)}
                        </span>
                        <span className="settle-arrow"><ArrowRight size={14} /></span>
                        <span className="settle-name" style={{ color: toMe ? 'var(--success-color)' : 'inherit', fontWeight: toMe ? 700 : 500 }}>
                          {toMe ? 'You' : getMemberName(settle.to)}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="settlement-amount" style={{ margin: 0 }}>{formatCurrency(settle.amount)}</span>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', minWidth: 'auto' }}
                          onClick={() => openSettleModalWithDetails(settle.from, settle.to, settle.amount)}
                          title="Settle this debt"
                        >
                          Settle
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Group Members List */}
          <div className="section-panel glass-panel">
            <div className="panel-header">
              <h3>Group Members</h3>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: 'var(--border-radius-sm)' }}
                onClick={openMemberModal}
              >
                <UserPlus size={14} />
                <span>Invite</span>
              </button>
            </div>

            <div className="members-list">
              {members.map(member => {
                const email = member.Email.toLowerCase();
                const bal = calculations.netBalances[email] || 0;
                
                return (
                  <div key={member.ID || email} className="member-row">
                    <div className="member-avatar-name">
                      <div className="member-avatar">
                        {member.Name ? member.Name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="member-name-email">
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                          {member.Name} {email === myEmail && '(You)'}
                        </span>
                        <span className="member-email-txt">{member.Email}</span>
                      </div>
                    </div>
                    
                    <div className={`member-bal ${bal > 0 ? 'credit' : bal < 0 ? 'debt' : 'neutral'}`}>
                      {bal > 0 ? 'gets back ' : bal < 0 ? 'owes ' : 'settled'}
                      {bal !== 0 && formatCurrency(Math.abs(bal))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL 1: ADD EXPENSE --- */}
      {isExpenseModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3>{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              <button className="btn-close-modal" onClick={() => setIsExpenseModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit}>
              {submitError && <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem' }}>{submitError}</div>}

              <div className="form-group">
                <label className="form-label">Description</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Dinner, Uber, Groceries"
                  value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Amount ({getCurrencySymbol(config.Currency)})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    className="form-input" 
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Paid By</label>
                  <select 
                    className="form-select"
                    value={expensePayer}
                    onChange={e => setExpensePayer(e.target.value)}
                  >
                    {members.map(m => (
                      <option key={m.Email} value={m.Email.toLowerCase()}>
                        {m.Name} ({m.Email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select 
                    className="form-select"
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                  >
                    <option value="General">General</option>
                    <option value="Food">Food</option>
                    <option value="Rent">Rent</option>
                    <option value="Transport">Transport</option>
                    <option value="Entertainment">Entertainment</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Split Method</label>
                <select 
                  className="form-select"
                  value={expenseSplitType}
                  onChange={e => setExpenseSplitType(e.target.value)}
                >
                  <option value="EQUAL">Split Equally</option>
                  <option value="EXACT">Exact Amounts</option>
                </select>
              </div>

              {expenseSplitType === 'EQUAL' ? (
                <div className="form-group">
                  <label className="form-label">Split details: Who is involved?</label>
                  <div className="member-split-selection">
                    {members.map(m => {
                      const email = m.Email.toLowerCase();
                      const checked = splitShares[email]?.checked ?? true;
                      
                      return (
                        <label key={email} className="member-split-checkbox">
                          <span className="checkbox-label">
                            <input 
                              type="checkbox" 
                              checked={checked}
                              onChange={() => {
                                setSplitShares(prev => ({
                                  ...prev,
                                  [email]: { ...prev[email], checked: !checked }
                                }));
                              }}
                            />
                            <span>{m.Name}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="split-type-info">
                    The amount will be divided equally among all checked members.
                  </p>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Split details: Exact Amounts ({getCurrencySymbol(config.Currency)})</label>
                  <div className="member-split-selection">
                    {members.map(m => {
                      const email = m.Email.toLowerCase();
                      const val = splitShares[email]?.amount ?? '';
                      
                      return (
                        <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.9rem' }}>{m.Name}</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            className="custom-split-input"
                            value={val}
                            onChange={e => {
                              setSplitShares(prev => ({
                                ...prev,
                                [email]: { ...prev[email], amount: e.target.value }
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="split-type-info">
                    Enter the exact amount that each person owes. Sum of balances must equal the expense total.
                  </p>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsExpenseModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Saving...' : (editingExpense ? 'Save Changes' : 'Save Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: INVITE MEMBER --- */}
      {isMemberModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3>Invite Group Member</h3>
              <button className="btn-close-modal" onClick={() => setIsMemberModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit}>
              {submitError && <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem' }}>{submitError}</div>}

              <div className="form-group">
                <label className="form-label">Friend's Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Alice Vance"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Friend's Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="e.g., alice@gmail.com"
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={shareOnInvite}
                    onChange={e => setShareOnInvite(e.target.checked)}
                  />
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Also share the Google Sheet with this friend</strong>
                </label>
                <p className="split-type-info" style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                  This automatically sends them a Google Drive email invitation to collaborate on this group sheet.
                </p>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--panel-border)' }}>
                <label className="form-label">Or send them the Group Share ID</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={spreadsheetId} 
                    readOnly 
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ whiteSpace: 'nowrap', padding: '0.85rem 1rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(spreadsheetId);
                      alert('Group ID copied to clipboard! Send this to your friend.');
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsMemberModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: SHARE SHEET --- */}
      {isShareModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3>Share Spreadsheet with Friend</h3>
              <button className="btn-close-modal" onClick={() => setIsShareModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleShareSubmit}>
              {submitError && <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem' }}>{submitError}</div>}
              {shareSuccessMsg && (
                <div style={{ color: 'var(--success-color)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '1rem', borderRadius: 'var(--border-radius-md)' }}>
                  {shareSuccessMsg}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Friend's Google Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="e.g., bob@gmail.com"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  required
                />
              </div>

              <p className="split-type-info">
                This shares the Google Sheet in your Drive with your friend, giving them access to read and write. Google will send them a notification email.
              </p>

              <div className="form-group" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--panel-border)' }}>
                <label className="form-label">Group Share Link / ID</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={spreadsheetId} 
                    readOnly 
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ whiteSpace: 'nowrap', padding: '0.85rem 1rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(spreadsheetId);
                      alert('Group ID copied to clipboard! Send this to your friend so they can click "Join Group by Link" in their sidebar.');
                    }}
                  >
                    Copy
                  </button>
                </div>
                <p className="split-type-info" style={{ marginTop: '0.5rem' }}>
                  Give this Spreadsheet ID to friends you've shared the sheet with so they can connect instantly from their sidebars.
                </p>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsShareModalOpen(false)}>Close</button>
                <button type="submit" className="btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Sharing...' : 'Share Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: SETTLE UP --- */}
      {isSettleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3>Record a Payment (Settle Up)</h3>
              <button className="btn-close-modal" onClick={() => setIsSettleModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit}>
              {submitError && <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem' }}>{submitError}</div>}

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Who Paid? (Debtor)</label>
                  <select 
                    className="form-select"
                    value={settleFrom}
                    onChange={e => setSettleFrom(e.target.value)}
                  >
                    {members.map(m => (
                      <option key={m.Email} value={m.Email.toLowerCase()}>
                        {m.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Who Received? (Creditor)</label>
                  <select 
                    className="form-select"
                    value={settleTo}
                    onChange={e => setSettleTo(e.target.value)}
                  >
                    {members.map(m => (
                      <option key={m.Email} value={m.Email.toLowerCase()}>
                        {m.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Amount ({getCurrencySymbol(config.Currency)})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    className="form-input" 
                    placeholder="0.00"
                    value={settleAmount}
                    onChange={e => setSettleAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={settleDate}
                    onChange={e => setSettleDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <p className="split-type-info">
                This will record a special payment transaction from <strong>{getMemberName(settleFrom)}</strong> to <strong>{getMemberName(settleTo)}</strong> to settle their outstanding balances.
              </p>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsSettleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
