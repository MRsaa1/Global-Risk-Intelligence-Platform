import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Grid,
  Paper,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Assessment as ScenariosIcon,
  Calculate as CalculationsIcon,
  AccountBalance as PortfoliosIcon,
  TrendingUp as TrendingIcon,
  Shield as ComplianceIcon,
  Speed as PerformanceIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { scenariosApi, calculationsApi, portfoliosApi } from '../services/api';

export default function Dashboard() {
  const { t } = useTranslation();

  const { data: scenarios = [] } = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => scenariosApi.list().then((res) => res.data),
  });

  const { data: calculations = [] } = useQuery({
    queryKey: ['calculations'],
    queryFn: () => calculationsApi.list().then((res) => res.data),
  });

  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => portfoliosApi.list().then((res) => res.data),
  });

  const activeScenarios = scenarios.filter((s) => s.status === 'running').length;
  const completedCalculations = calculations.filter((c) => c.status === 'completed').length;
  const runningCalculations = calculations.filter((c) => c.status === 'running').length;
  const failedCalculations = calculations.filter((c) => c.status === 'failed').length;

  // Mock data for charts
  const metricsData = [
    { name: 'Jan', capital: 12.5, lcr: 1.2, nsfr: 1.15 },
    { name: 'Feb', capital: 12.8, lcr: 1.25, nsfr: 1.18 },
    { name: 'Mar', capital: 13.1, lcr: 1.3, nsfr: 1.22 },
    { name: 'Apr', capital: 12.9, lcr: 1.28, nsfr: 1.20 },
    { name: 'May', capital: 13.2, lcr: 1.32, nsfr: 1.25 },
    { name: 'Jun', capital: 13.5, lcr: 1.35, nsfr: 1.28 },
  ];

  const complianceData = [
    { framework: 'Basel IV', status: 'Compliant', ratio: 12.5 },
    { framework: 'LCR', status: 'Compliant', ratio: 135 },
    { framework: 'NSFR', status: 'Compliant', ratio: 128 },
    { framework: 'FRTB', status: 'In Review', ratio: 95 },
  ];

  return (
    <Box sx={{ p: 4, bgcolor: '#0a0e27', minHeight: '100vh', color: '#ffffff' }}>
      <Box mb={4}>
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            letterSpacing: '-0.02em',
            mb: 1,
          }}
        >
          Risk Intelligence Dashboard
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.95rem',
          }}
        >
          Comprehensive overview of risk metrics, regulatory compliance, and calculation performance
        </Typography>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              background: '#1a1f3a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'rgba(212, 175, 55, 0.3)',
              },
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    Active Scenarios
                  </Typography>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontWeight: 600,
                      color: '#ffffff',
                    }}
                  >
                    {activeScenarios}
                  </Typography>
                </Box>
                <ScenariosIcon sx={{ fontSize: 40, color: '#d4af37', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              background: '#1a1f3a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'rgba(212, 175, 55, 0.3)',
              },
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    Running Calculations
                  </Typography>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontWeight: 600,
                      color: '#ffffff',
                    }}
                  >
                    {runningCalculations}
                  </Typography>
                </Box>
                <CalculationsIcon sx={{ fontSize: 40, color: '#d4af37', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              background: '#1a1f3a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'rgba(212, 175, 55, 0.3)',
              },
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    Completed Calculations
                  </Typography>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontWeight: 600,
                      color: '#ffffff',
                    }}
                  >
                    {completedCalculations}
                  </Typography>
                </Box>
                <TrendingIcon sx={{ fontSize: 40, color: '#d4af37', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              background: '#1a1f3a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'rgba(212, 175, 55, 0.3)',
              },
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    Portfolios
                  </Typography>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontWeight: 600,
                      color: '#ffffff',
                    }}
                  >
                    {portfolios.length}
                  </Typography>
                </Box>
                <PortfoliosIcon sx={{ fontSize: 40, color: '#d4af37', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              📈 Risk Metrics Trend
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="capital"
                  stroke="#667eea"
                  strokeWidth={2}
                  name="Capital Ratio (%)"
                />
                <Line
                  type="monotone"
                  dataKey="lcr"
                  stroke="#f5576c"
                  strokeWidth={2}
                  name="LCR"
                />
                <Line
                  type="monotone"
                  dataKey="nsfr"
                  stroke="#4facfe"
                  strokeWidth={2}
                  name="NSFR"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              🛡️ Compliance Status
            </Typography>
            <Box sx={{ mt: 2 }}>
              {complianceData.map((item) => (
                <Box key={item.framework} sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.framework}
                    </Typography>
                    <Chip
                      label={item.status}
                      color={item.status === 'Compliant' ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={item.ratio}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Ratio: {item.ratio}%
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity & Performance */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              🔄 Recent Activity
            </Typography>
            <Box sx={{ mt: 2 }}>
              {calculations.slice(0, 5).map((calc) => (
                <Box key={calc.calculation_id} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {calc.scenario_id}
                    </Typography>
                    <Chip
                      label={calc.status}
                      color={
                        calc.status === 'completed'
                          ? 'success'
                          : calc.status === 'running'
                          ? 'info'
                          : calc.status === 'failed'
                          ? 'error'
                          : 'default'
                      }
                      size="small"
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {calc.created_at
                      ? new Date(calc.created_at).toLocaleString()
                      : '-'}
                  </Typography>
                  {calc.status === 'running' && (
                    <LinearProgress sx={{ mt: 1 }} />
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              ⚡ Performance Metrics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="primary.contrastText">
                    &lt;45s
                  </Typography>
                  <Typography variant="caption" color="primary.contrastText">
                    p95 Latency
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="success.contrastText">
                    99.95%
                  </Typography>
                  <Typography variant="caption" color="success.contrastText">
                    Availability
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.light', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="info.contrastText">
                    100k+
                  </Typography>
                  <Typography variant="caption" color="info.contrastText">
                    Positions/Calc
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={700} color="warning.contrastText">
                    5+
                  </Typography>
                  <Typography variant="caption" color="warning.contrastText">
                    Jurisdictions
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
