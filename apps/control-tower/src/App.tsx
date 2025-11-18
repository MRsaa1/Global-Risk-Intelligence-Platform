import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scenarios from './pages/Scenarios';
import Calculations from './pages/Calculations';
import CalculationDetail from './pages/CalculationDetail';
import Portfolios from './pages/Portfolios';
import Demo from './pages/Demo';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/scenarios"
          element={
            <ProtectedRoute>
              <Layout>
                <Scenarios />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calculations"
          element={
            <ProtectedRoute>
              <Layout>
                <Calculations />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolios"
          element={
            <ProtectedRoute>
              <Layout>
                <Portfolios />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calculations/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <CalculationDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/demo"
          element={
            <Layout>
              <Demo />
            </Layout>
          }
        />
      </Routes>
    </ThemeProvider>
  );
}

export default App;

