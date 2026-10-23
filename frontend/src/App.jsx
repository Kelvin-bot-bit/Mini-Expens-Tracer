import { useEffect, useMemo, useState } from 'react'
import {
  Wallet, LayoutDashboard, ArrowLeftRight, LogOut, Plus, Search, TrendingUp,
  TrendingDown, PiggyBank, Pencil, Trash2, X, CalendarDays, Tags, ShieldCheck,
  LoaderCircle, CircleDollarSign
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts'
import { api, clearSession, getSavedUser, getToken, setSession } from './api'

const categories = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Health', 'Education', 'Salary', 'Freelance', 'Other']
const today = () => new Date().toISOString().slice(0, 10)
const money = (n) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(Number(n || 0))
const blankForm = () => ({ title: '', amount: '', kind: 'expense', category: 'Food', transaction_date: today(), note: '' })

export default function App() {
  const [user, setUser] = useState(getSavedUser)
  const [token, setToken] = useState(getToken())
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState('overview')
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0, monthly_expenses: [], category_expenses: [], recent_transactions: [] })
  const [transactions, setTransactions] = useState([])
  const [filters, setFilters] = useState({ search: '', kind: '', category: '' })
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function loadDashboard() {
    const [s, t] = await Promise.all([api('/dashboard/summary'), api('/transactions')])
    setSummary(s)
    setTransactions(t.transactions)
  }

  useEffect(() => {
    if (token) loadDashboard().catch((e) => {
      setError(e.message)
      // Invalid/expired JWTs must not leave the app stuck in an authenticated state.
      if (e.status === 401 || e.status === 422 || /token|authorization|unauthorized|session has expired/i.test(e.message)) {
        logout()
        setAuthError('Your session is invalid or expired. Please sign in again.')
      }
    })
  }, [token])

  function logout() {
    clearSession()
    setToken(null)
    setUser(null)
    setTransactions([])
    setSummary({ income: 0, expense: 0, balance: 0, monthly_expenses: [], category_expenses: [], recent_transactions: [] })
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthError('')
    setLoading(true)
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(authForm) })
      setSession(data.access_token, data.user)
      setUser(data.user)
      setToken(data.access_token)
    } catch (e) { setAuthError(e.message) }
    finally { setLoading(false) }
  }

  async function refresh() {
    const [s, t] = await Promise.all([api('/dashboard/summary'), api('/transactions')])
    setSummary(s)
    setTransactions(t.transactions)
  }

  function openCreate() {
    setEditingId(null)
    setForm(blankForm())
    setError('')
    setModal(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({ title: item.title, amount: String(item.amount), kind: item.kind, category: item.category, transaction_date: item.transaction_date, note: item.note || '' })
    setError('')
    setModal(true)
  }

  async function saveTransaction(e) {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form, amount: Number(form.amount) }
      await api(editingId ? `/transactions/${editingId}` : '/transactions', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setModal(false)
      setNotice(editingId ? 'Transaction updated.' : 'Transaction added.')
      await refresh()
      window.setTimeout(() => setNotice(''), 2800)
    } catch (e) { setError(e.message) }
  }

  async function deleteTransaction(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    try {
      await api(`/transactions/${item.id}`, { method: 'DELETE' })
      setNotice('Transaction deleted.')
      await refresh()
      window.setTimeout(() => setNotice(''), 2800)
    } catch (e) { setError(e.message) }
  }

  const filtered = useMemo(() => transactions.filter((t) => {
    const q = filters.search.toLowerCase()
    return (!q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) &&
      (!filters.kind || t.kind === filters.kind) &&
      (!filters.category || t.category === filters.category)
  }), [transactions, filters])

  if (!token) {
    return <div className="auth-page">
      <div className="auth-art">
        <div className="brand"><span className="brand-mark"><Wallet size={21} /></span> PesaTrack</div>
        <div className="auth-message">
          <span className="eyebrow">YOUR MONEY, IN FOCUS</span>
          <h1>Make every shilling<br />count.</h1>
          <p>A clearer picture of your spending starts with one simple habit: tracking it.</p>
          <div className="auth-mini-card">
            <div className="mini-icon"><TrendingUp size={20} /></div>
            <div><small>Monthly overview</small><strong>Know where it goes.</strong></div>
            <span className="mini-pill">Stay in control</span>
          </div>
        </div>
        <div className="auth-foot">Personal finance, made simpler.</div>
      </div>
      <div className="auth-panel">
        <form className="auth-form" onSubmit={handleAuth}>
          <div className="mobile-brand brand"><span className="brand-mark"><Wallet size={21} /></span> PesaTrack</div>
          <span className="eyebrow">{authMode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</span>
          <h2>{authMode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
          <p className="muted">{authMode === 'login' ? 'Your financial overview is waiting for you.' : 'Start building a healthier money habit today.'}</p>
          {authMode === 'register' && <label>Full name<input required maxLength="80" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="e.g. Alex Mwangi" /></label>}
          <label>Email address<input required type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
          <label>Password<input required type="password" minLength="8" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" /></label>
          {authError && <div className="alert">{authError}</div>}
          <button className="primary full" disabled={loading}>{loading && <LoaderCircle className="spin" size={17} />}{authMode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
          <p className="switch-auth">{authMode === 'login' ? "Don't have an account?" : 'Already have an account?'} <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}>{authMode === 'login' ? 'Create one' : 'Sign in'}</button></p>
          <div className="secure-note"><ShieldCheck size={15} /> Your data is private to your account.</div>
        </form>
      </div>
    </div>
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Wallet size={21} /></span> PesaTrack</div>
      <div className="side-label">WORKSPACE</div>
      <button className={`nav-link ${page === 'overview' ? 'active' : ''}`} onClick={() => setPage('overview')}><LayoutDashboard size={18} /> Overview</button>
      <button className={`nav-link ${page === 'transactions' ? 'active' : ''}`} onClick={() => setPage('transactions')}><ArrowLeftRight size={18} /> Transactions</button>
      <div className="sidebar-bottom">
        <div className="side-tip"><div className="tip-icon"><PiggyBank size={19} /></div><strong>Small steps add up.</strong><p>Track every transaction to understand your habits.</p></div>
        <div className="user-card"><div className="avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div><div className="user-info"><strong>{user?.name || 'Your account'}</strong><span>{user?.email}</span></div><button className="icon-button logout" title="Log out" onClick={logout}><LogOut size={17} /></button></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><div className="breadcrumb">Workspace <span>/</span> {page === 'overview' ? 'Overview' : 'Transactions'}</div><h1>{page === 'overview' ? 'Financial overview' : 'Transactions'}</h1></div><button className="primary" onClick={openCreate}><Plus size={17} /> Add transaction</button></header>
      {notice && <div className="toast"><span>✓</span> {notice}</div>}
      {error && !modal && <div className="alert inline-alert">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

      {page === 'overview' ? <>
        <div className="welcome-row"><div><h2>Good to see you, {user?.name?.split(' ')[0] || 'there'} <span>✦</span></h2><p className="muted">Here’s how your money is looking.</p></div><div className="date-chip"><CalendarDays size={15} /> {new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</div></div>
        <section className="stats-grid">
          <StatCard title="Total balance" value={money(summary.balance)} icon={<Wallet size={19} />} tone="purple" caption="Income minus expenses" />
          <StatCard title="Total income" value={money(summary.income)} icon={<TrendingUp size={19} />} tone="green" caption="All recorded income" />
          <StatCard title="Total expenses" value={money(summary.expense)} icon={<TrendingDown size={19} />} tone="orange" caption="All recorded spending" />
        </section>
        <section className="content-grid">
          <div className="panel chart-panel"><div className="panel-heading"><div><h3>Spending overview</h3><p className="muted">Monthly expense trend</p></div><span className="chart-legend"><i /> Expenses</span></div>
            {summary.monthly_expenses.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.monthly_expenses} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><defs><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7565e8" stopOpacity={0.22}/><stop offset="95%" stopColor="#7565e8" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9edf4"/><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8992a5' }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 11, fill: '#8992a5' }} axisLine={false} tickLine={false} width={55}/><Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e7eaf1', fontSize: 12 }}/><Area type="monotone" dataKey="total" stroke="#7565e8" strokeWidth={2.5} fill="url(#expenseFill)" /></AreaChart></ResponsiveContainer></div> : <EmptyState icon={<TrendingDown size={23}/>} title="Your chart starts here" text="Add an expense and your monthly trend will appear." />}
          </div>
          <div className="panel category-panel"><div className="panel-heading"><div><h3>Spending by category</h3><p className="muted">Where your money goes</p></div><Tags size={18} className="muted-icon" /></div>
            {summary.category_expenses.length ? <div className="category-list">{summary.category_expenses.map((c, i) => <div className="category-item" key={c.category}><div className="category-meta"><span><i className={`category-dot dot-${i % 5}`} />{c.category}</span><strong>{money(c.total)}</strong></div><div className="progress-track"><div className={`progress-fill fill-${i % 5}`} style={{ width: `${Math.max(3, c.total / summary.expense * 100)}%` }} /></div></div>)}</div> : <EmptyState icon={<CircleDollarSign size={23}/>} title="No spending yet" text="Your category breakdown will show up here." />}
          </div>
        </section>
        <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent transactions</h3><p className="muted">Your latest money activity</p></div><button className="text-button" onClick={() => setPage('transactions')}>View all <span>→</span></button></div><TransactionTable items={summary.recent_transactions} onEdit={openEdit} onDelete={deleteTransaction} compact /></section>
      </> : <section className="panel transactions-panel">
        <div className="filters"><div className="search-box"><Search size={17}/><input placeholder="Search transactions..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}/></div><select value={filters.kind} onChange={e => setFilters({ ...filters, kind: e.target.value })}><option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option></select><select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <TransactionTable items={filtered} onEdit={openEdit} onDelete={deleteTransaction} />
        <div className="table-footer">Showing <strong>{filtered.length}</strong> of <strong>{transactions.length}</strong> transactions</div>
      </section>}
      <footer className="page-footer"><span>© {new Date().getFullYear()} PesaTrack</span><span><ShieldCheck size={14}/> Your finances, your control.</span></footer>
    </main>

    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false) }}><form className="modal" onSubmit={saveTransaction}>
      <div className="modal-heading"><div><span className="eyebrow">{editingId ? 'UPDATE RECORD' : 'NEW RECORD'}</span><h2>{editingId ? 'Edit transaction' : 'Add transaction'}</h2></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X size={20}/></button></div>
      <div className="kind-toggle"><button type="button" className={form.kind === 'expense' ? 'selected expense' : ''} onClick={() => setForm({ ...form, kind: 'expense', category: 'Food' })}><TrendingDown size={17}/> Expense</button><button type="button" className={form.kind === 'income' ? 'selected income' : ''} onClick={() => setForm({ ...form, kind: 'income', category: 'Salary' })}><TrendingUp size={17}/> Income</button></div>
      <label>Transaction title<input required maxLength="120" placeholder="e.g. Weekly groceries" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
      <label>Amount (KES)<div className="amount-input"><span>KSh</span><input required type="number" min="0.01" step="0.01" max="9999999999.99" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></div></label>
      <div className="form-row"><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.filter(c => form.kind === 'income' ? ['Salary', 'Freelance', 'Other'].includes(c) : c !== 'Salary' && c !== 'Freelance').map(c => <option key={c}>{c}</option>)}</select></label><label>Date<input type="date" required value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })}/></label></div>
      <label>Note <span className="optional">(optional)</span><textarea rows="3" maxLength="500" placeholder="Add a little detail..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}/></label>
      {error && <div className="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button><button className="primary" type="submit">{editingId ? 'Save changes' : 'Add transaction'}</button></div>
    </form></div>}
  </div>
}

function StatCard({ title, value, icon, tone, caption }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-caption">{caption}</span></div>
}

function EmptyState({ icon, title, text }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p></div>
}

function TransactionTable({ items, onEdit, onDelete, compact = false }) {
  if (!items?.length) return <EmptyState icon={<ArrowLeftRight size={23}/>} title="No transactions to show" text="Add your first transaction to get started." />
  return <div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><div className="transaction-title"><span className={`transaction-icon ${item.kind}`} >{item.kind === 'income' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}</span><span><strong>{item.title}</strong>{!compact && item.note && <small>{item.note}</small>}</span></div></td><td><span className="category-badge">{item.category}</span></td><td className="date-cell">{new Date(`${item.transaction_date}T12:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td className={`amount-cell ${item.kind}`}>{item.kind === 'income' ? '+' : '−'}{money(item.amount)}</td><td><div className="row-actions"><button className="icon-button" title="Edit" onClick={() => onEdit(item)}><Pencil size={15}/></button><button className="icon-button danger-hover" title="Delete" onClick={() => onDelete(item)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
}
