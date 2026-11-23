import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dan from './pages/Dan'
import ThuGom from './pages/ThuGom'
import Admin from './pages/Admin'
import TaoYeuCau from './pages/TaoYeuCau'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dan" element={
          <ProtectedRoute allowedRoles={['DAN']}>
            {user => <Dan user={user} />}
          </ProtectedRoute>
        } />
        <Route path="/thugom" element={
          <ProtectedRoute allowedRoles={['THUGOM']}>
            {user => <ThuGom user={user} />}
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            {user => <Admin user={user} />}
          </ProtectedRoute>
        } />
        <Route path="/dan/tao-yeu-cau" element={
          <ProtectedRoute allowedRoles={['DAN']}>
            {() => <TaoYeuCau />}
          </ProtectedRoute>
        } />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
