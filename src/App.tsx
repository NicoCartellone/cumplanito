import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import FriendsPage from './pages/FriendsPage'
import BottomNav from './shared/ui/BottomNav'

export default function App() {
  return (
    <main className="shell">
      <div className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/amigos" element={<FriendsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <BottomNav />
    </main>
  )
}