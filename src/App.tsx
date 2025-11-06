import type React from 'react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { Task, Priority, Status } from './types.ts'
import { calculateRoi, formatCurrency, formatNumber, safeNumber } from './utils/number.ts'

type DialogState =
  | { type: 'none' }
  | { type: 'view'; task: Task }
  | { type: 'edit'; task?: Task }
  | { type: 'delete'; task: Task }

const STORAGE_KEY = 'taskapp.tasks.v1'

function useTasks() {
  const initialized = useRef(false)
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as Task[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  // Guard against React StrictMode double effect by using a ref flag
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    // Simulate one-time data load side-effects if needed in the future
  }, [])

  // persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const [lastDeleted, setLastDeleted] = useState<Task | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const addTask = (t: Omit<Task, 'id' | 'createdAt'>) => {
    const now = Date.now()
    const task: Task = { ...t, id: `${now}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now }
    setTasks((prev) => [task, ...prev])
  }

  const updateTask = (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const deleteTask = (id: string) => {
    setTasks((prev) => {
      const t = prev.find((x) => x.id === id) || null
      if (t) {
        setLastDeleted(t)
        setSnackbarOpen(true)
      }
      return prev.filter((x) => x.id !== id)
    })
  }

  const undoDelete = () => {
    if (!lastDeleted) return
    setTasks((prev) => [lastDeleted, ...prev])
    setLastDeleted(null)
    setSnackbarOpen(false)
  }

  const onSnackbarClose = () => {
    // BUG 2 fix: ensure state is cleared when snackbar closes
    setSnackbarOpen(false)
    setLastDeleted(null)
  }

  const importCsv = (rows: TaskCsvRow[]) => {
    const now = Date.now()
    const imported: Task[] = rows.map((r, idx) => {
      const revenue = safeNumber(r.revenue)
      const time = safeNumber(r.time)
      const roi = calculateRoi(revenue, time)
      return {
        id: `${now + idx}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now + idx,
        title: r.title?.trim() || `Task ${idx + 1}`,
        revenue,
        time,
        roi,
        notes: r.notes?.trim() || '',
        priority: (r.priority as Priority) || 'Medium',
        status: (r.status as Status) || 'Todo',
      }
    })
    setTasks((prev) => [...imported, ...prev])
  }

  const exportCsv = () => {
    const header = 'title,revenue,time,roi,notes,priority,status,createdAt,id\n'
    const body = tasks
      .map((t) =>
        [
          escapeCsv(t.title),
          t.revenue,
          t.time,
          t.roi,
          escapeCsv(t.notes || ''),
          t.priority,
          t.status,
          t.createdAt,
          t.id,
        ].join(',')
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tasks.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    undoDelete,
    importCsv,
    exportCsv,
    snackbarOpen,
    onSnackbarClose,
  }
}

function escapeCsv(v: string) {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replaceAll('"', '""') + '"'
  }
  return v
}

type TaskCsvRow = {
  title: string
  revenue: string
  time: string
  notes?: string
  priority?: string
  status?: string
}

function App() {
  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    undoDelete,
    importCsv,
    exportCsv,
    snackbarOpen,
    onSnackbarClose,
  } = useTasks()

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All')

  // Sort: ROI desc, Priority High>Medium>Low, Title asc (stable)
  const sortedFiltered = useMemo(() => {
    const priRank: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 }
    return tasks
      .filter((t) =>
        (priorityFilter === 'All' || t.priority === priorityFilter) &&
        (statusFilter === 'All' || t.status === statusFilter) &&
        t.title.toLowerCase().includes(search.toLowerCase())
      )
      .slice() // avoid in-place sort mutation
      .sort((a, b) => {
        const ar = Number(a.roi || 0)
        const br = Number(b.roi || 0)
        if (ar !== br) return br - ar // ROI desc
        const ap = priRank[a.priority]
        const bp = priRank[b.priority]
        if (ap !== bp) return bp - ap // Priority desc
        // BUG 3 fix: stable tie-breaker by title, then createdAt desc
        const at = a.title.toLowerCase()
        const bt = b.title.toLowerCase()
        if (at !== bt) return at.localeCompare(bt)
        return b.createdAt - a.createdAt
      })
  }, [tasks, priorityFilter, statusFilter, search])

  const totals = useMemo(() => {
    const revenue = tasks.reduce((s, t) => s + safeNumber(t.revenue), 0)
    const time = tasks.reduce((s, t) => s + Math.max(0, safeNumber(t.time)), 0)
    const efficiency = time > 0 ? revenue / time : 0
    const validRois = tasks
      .map((t) => calculateRoi(t.revenue, t.time))
      .filter((x) => Number.isFinite(x) && x > 0)
    const avgRoi = validRois.length ? validRois.reduce((a, b) => a + b, 0) / validRois.length : 0
    const grade = avgRoi >= 5 ? 'A' : avgRoi >= 2 ? 'B' : avgRoi > 0 ? 'C' : '—'
    return { revenue, efficiency, avgRoi, grade }
  }, [tasks])

  const openAdd = () => setDialog({ type: 'edit' })
  const openView = (task: Task) => setDialog({ type: 'view', task })
  const openEdit = (task: Task) => setDialog({ type: 'edit', task })
  const openDelete = (task: Task) => setDialog({ type: 'delete', task })
  const closeDialog = () => setDialog({ type: 'none' })

  const onSubmitTask = (data: Partial<Task>) => {
    const revenue = safeNumber(data.revenue)
    const time = safeNumber(data.time)
    const roi = calculateRoi(revenue, time)
    if (dialog.type === 'edit' && dialog.task) {
      updateTask(dialog.task.id, {
        ...dialog.task,
        title: data.title?.trim() || 'Untitled',
        revenue,
        time,
        roi,
        notes: data.notes || '',
        priority: (data.priority as Priority) || 'Medium',
        status: (data.status as Status) || 'Todo',
      })
    } else {
      addTask({
        title: data.title?.trim() || 'Untitled',
        revenue,
        time,
        roi,
        notes: data.notes || '',
        priority: (data.priority as Priority) || 'Medium',
        status: (data.status as Status) || 'Todo',
      })
    }
    closeDialog()
  }

  const onConfirmDelete = () => {
    if (dialog.type === 'delete' && dialog.task) {
      deleteTask(dialog.task.id)
      closeDialog()
    }
  }

  const onCsvSelect = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const rows = parseCsv(text)
      importCsv(rows)
    }
    reader.readAsText(file)
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Task ROI Manager</h1>
        <div className="header-actions">
          <button className="btn primary" onClick={openAdd}>Add Task</button>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
          <label className="btn">Import CSV
            <input type="file" accept=".csv" onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onCsvSelect(f)
              e.currentTarget.value = ''
            }} />
          </label>
        </div>
      </header>

      <section className="summary">
        <div className="summary-item"><span>Total Revenue</span><strong>{formatCurrency(totals.revenue)}</strong></div>
        <div className="summary-item"><span>Efficiency</span><strong>{formatNumber(totals.efficiency)} /h</strong></div>
        <div className="summary-item"><span>Average ROI</span><strong>{formatNumber(totals.avgRoi)}</strong></div>
        <div className="summary-item"><span>Grade</span><strong>{totals.grade}</strong></div>
      </section>

      <section className="filters">
        <input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
  <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'All' | Priority)}>
          <option value="All">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | Status)}>
          <option value="All">All Statuses</option>
          <option value="Todo">Todo</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
      </section>

      <section className="table">
        <div className="table-head">
          <div>Title</div>
          <div className="num">Revenue</div>
          <div className="num">Time</div>
          <div className="num">ROI</div>
          <div>Priority</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div className="table-body">
          {sortedFiltered.map((t) => (
            <div key={t.id} className="row" onClick={() => openView(t)}>
              <div className="title" title={t.title}>{t.title}</div>
              <div className="num">{formatCurrency(t.revenue)}</div>
              <div className="num">{formatNumber(t.time)} h</div>
              <div className="num">{t.time > 0 && t.revenue >= 0 ? formatNumber(calculateRoi(t.revenue, t.time)) : '—'}</div>
              <div><span className={`pill ${t.priority.toLowerCase()}`}>{t.priority}</span></div>
              <div><span className={`pill status ${t.status.replace(' ', '-').toLowerCase()}`}>{t.status}</span></div>
              <div className="actions">
                <button className="link" onClick={(e) => { e.stopPropagation(); openEdit(t) }}>Edit</button>
                <button className="link danger" onClick={(e) => { e.stopPropagation(); openDelete(t) }}>Delete</button>
              </div>
            </div>
          ))}
          {sortedFiltered.length === 0 && (
            <div className="empty">No tasks found. Try adjusting filters.</div>
          )}
        </div>
      </section>

      {dialog.type === 'view' && (
        <Modal onClose={closeDialog} title="Task Details">
          <TaskView task={dialog.task} />
        </Modal>
      )}

      {dialog.type === 'edit' && (
        <Modal onClose={closeDialog} title={dialog.task ? 'Edit Task' : 'Add Task'}>
          <TaskForm initial={dialog.task} onSubmit={onSubmitTask} />
        </Modal>
      )}

      {dialog.type === 'delete' && (
        <Modal onClose={closeDialog} title="Delete Task">
          <div className="confirm">
            <p>Are you sure you want to delete "{dialog.task.title}"?</p>
            <div className="confirm-actions">
              <button className="btn" onClick={closeDialog}>Cancel</button>
              <button className="btn danger" onClick={onConfirmDelete}>Delete</button>
            </div>
          </div>
        </Modal>
      )}

      <Snackbar
        open={snackbarOpen}
        message="Task deleted"
        actionLabel="Undo"
        onAction={undoDelete}
        onClose={onSnackbarClose}
        autoHideMs={3500}
      />
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const headingId = useMemo(() => `modal-title-${Math.random().toString(36).slice(2, 8)}`,[ ])

  useEffect(() => {
    // Save and move focus inside modal
    prevFocusRef.current = (document.activeElement as HTMLElement) || null
    const focusable = getFocusable(modalRef.current)
    ;(focusable[0] as HTMLElement | undefined)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const nodes = getFocusable(modalRef.current)
        if (nodes.length === 0) return
        const first = nodes[0] as HTMLElement
        const last = nodes[nodes.length - 1] as HTMLElement
        const active = document.activeElement as HTMLElement
        if (e.shiftKey) {
          if (active === first || !modalRef.current?.contains(active)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (active === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Restore focus to the trigger element if possible
      prevFocusRef.current?.focus()
    }
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={onClose}
      aria-hidden={false}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="modal-head">
          <h3 id={headingId}>{title}</h3>
          <button className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function getFocusable(root: HTMLElement | null): Element[] {
  if (!root) return []
  const selectors = [
    'a[href]','button:not([disabled])','textarea:not([disabled])','input:not([disabled])','select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ]
  return Array.from(root.querySelectorAll(selectors.join(',')))
}

function TaskView({ task }: { task: Task }) {
  return (
    <div className="view">
      <div className="view-row"><span>Title</span><strong>{task.title}</strong></div>
      <div className="view-row"><span>Revenue</span><strong>{formatCurrency(task.revenue)}</strong></div>
      <div className="view-row"><span>Time</span><strong>{formatNumber(task.time)} h</strong></div>
      <div className="view-row"><span>ROI</span><strong>{task.time > 0 ? formatNumber(calculateRoi(task.revenue, task.time)) : '—'}</strong></div>
      <div className="view-row"><span>Priority</span><strong>{task.priority}</strong></div>
      <div className="view-row"><span>Status</span><strong>{task.status}</strong></div>
      {task.notes && <div className="view-notes"><span>Notes</span><p>{task.notes}</p></div>}
    </div>
  )
}

function TaskForm({ initial, onSubmit }: { initial?: Task; onSubmit: (data: Partial<Task>) => void }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [revenue, setRevenue] = useState(String(initial?.revenue ?? ''))
  const [time, setTime] = useState(String(initial?.time ?? ''))
  const [notes, setNotes] = useState(initial?.notes || '')
  const [priority, setPriority] = useState<Priority>(initial?.priority || 'Medium')
  const [status, setStatus] = useState<Status>(initial?.status || 'Todo')

  // BUG 5 fix: live ROI with safe validation
  const revNum = safeNumber(revenue)
  const timeNum = safeNumber(time)
  const roi = calculateRoi(revNum, timeNum)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ title, revenue: revNum, time: timeNum, roi, notes, priority, status })
  }
  return (
    <form className="form" onSubmit={submit}>
      <div className="grid">
        <label>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title" required />
        </label>
        <label>
          <span>Revenue</span>
          <input inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="0" />
        </label>
        <label>
          <span>Time (hours)</span>
          <input inputMode="decimal" value={time} onChange={(e) => setTime(e.target.value)} placeholder="0" />
        </label>
        <label>
          <span>ROI</span>
          <output>{timeNum > 0 && revNum >= 0 ? formatNumber(roi) : '—'}</output>
        </label>
        <label>
          <span>Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option>Todo</option>
            <option>In Progress</option>
            <option>Done</option>
          </select>
        </label>
        <label className="col-span-2">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" rows={4} />
        </label>
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Save</button>
      </div>
    </form>
  )
}

function Snackbar({ open, message, actionLabel, onAction, onClose, autoHideMs = 3000 }: {
  open: boolean
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose?: () => void
  autoHideMs?: number
}) {
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (!open) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      onClose?.()
    }, autoHideMs)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [open, autoHideMs, onClose])

  if (!open) return null
  return (
    <div className="snackbar" role="status" aria-live="polite">
      <span>{message}</span>
      {actionLabel && <button className="link" onClick={onAction}>{actionLabel}</button>}
      <button className="icon" aria-label="Close" onClick={onClose}>✕</button>
    </div>
  )
}

// Simple CSV parser (no quotes across lines)
function parseCsv(text: string): TaskCsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length === 0) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  const rows: TaskCsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const raw = splitCsvLine(lines[i])
    const row: TaskCsvRow = {
      title: raw[idx('title')] || '',
      revenue: raw[idx('revenue')] || '',
      time: raw[idx('time')] || '',
      notes: raw[idx('notes')] || '',
      priority: raw[idx('priority')] || '',
      status: raw[idx('status')] || '',
    }
    rows.push(row)
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const res: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'; i++
        } else {
          inQ = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === ',') { res.push(cur); cur = '' }
      else if (ch === '"') { inQ = true }
      else { cur += ch }
    }
  }
  res.push(cur)
  return res.map((s) => s.trim())
}

export default App
