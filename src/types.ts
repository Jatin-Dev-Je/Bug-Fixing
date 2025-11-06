export type Priority = 'High' | 'Medium' | 'Low'

export type Status = 'Todo' | 'In Progress' | 'Done'

export interface Task {
  id: string
  createdAt: number
  title: string
  revenue: number
  time: number
  roi: number
  notes?: string
  priority: Priority
  status: Status
}
