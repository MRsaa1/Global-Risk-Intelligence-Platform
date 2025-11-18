import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Chip,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function Demo() {
  const [demoData, setDemoData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch demo data
    fetch('/api/v1/demo/data')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setDemoData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching demo data:', err);
        setLoading(false);
      });

    // Fetch metrics
    fetch('/api/v1/demo/metrics')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setMetrics(data.metrics || []);
      })
      .catch((err) => {
        console.error('Error fetching metrics:', err);
      });
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!demoData) {
    return (
      <Alert severity="error">
        Failed to load demo data. Make sure API Gateway is running on http://localhost:9002
      </Alert>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: '#0a0e27',
      color: '#ffffff',
      p: 4,
    }}>
      {/* Dashboard Metrics */}
      {false && (
      <Grid container spacing={3} sx={{ mb: 4, p: 6, maxWidth: '1400px', mx: 'auto' }}>
        <Grid item xs={12} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              p: 2, 
              borderRadius: '8px', 
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#6b7280',
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
                color: '#081C42',
                fontWeight: 600,
              }}
            >
              {demoData.dashboard.active_scenarios}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              p: 2, 
              borderRadius: '8px', 
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#6b7280',
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
                color: '#081C42',
                fontWeight: 600,
              }}
            >
              {demoData.dashboard.running_calculations}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              p: 2, 
              borderRadius: '8px', 
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#6b7280',
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
                color: '#081C42',
                fontWeight: 600,
              }}
            >
              {demoData.dashboard.completed_calculations}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card 
            elevation={0}
            sx={{ 
              p: 2, 
              borderRadius: '8px', 
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#6b7280',
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
                color: '#081C42',
                fontWeight: 600,
              }}
            >
              {demoData.dashboard.portfolios}
            </Typography>
          </Card>
        </Grid>
      </Grid>
      )}

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4, p: 6, maxWidth: '1400px', mx: 'auto' }}>
        <Grid item xs={12} md={6}>
          <Card 
            elevation={0}
            sx={{ 
              p: 3, 
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
            }}
          >
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                fontWeight: 600,
                color: '#081C42',
                fontSize: '1rem',
              }}
            >
              Key Risk Metrics
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
                sx={{ 
                  mb: 2,
                  pb: 2,
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <Typography
                  sx={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Total VaR
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#081C42',
                  }}
                >
                  ${(demoData.dashboard.total_var / 1000000).toFixed(1)}M
                </Typography>
              </Box>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
                sx={{ 
                  mb: 2,
                  pb: 2,
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <Typography
                  sx={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Total Capital
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#081C42',
                  }}
                >
                  ${(demoData.dashboard.total_capital / 1000000).toFixed(0)}M
                </Typography>
              </Box>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
              >
                <Typography
                  sx={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Capital Ratio
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: '#081C42',
                  }}
                >
                  {(demoData.dashboard.capital_ratio * 100).toFixed(2)}%
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card 
            elevation={0}
            sx={{ 
              p: 3, 
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
            }}
          >
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                fontWeight: 600,
                color: '#081C42',
                fontSize: '1rem',
              }}
            >
              Metrics Trends (30 days)
            </Typography>
            {metrics.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="capital_ratio" stroke="#667eea" strokeWidth={2} name="Capital Ratio" />
                  <Line type="monotone" dataKey="lcr" stroke="#43e97b" strokeWidth={2} name="LCR" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Scenarios */}
      <Card 
        elevation={0}
        sx={{ 
          p: 3, 
          borderRadius: '8px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          mb: 3,
        }}
      >
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            fontWeight: 600,
            color: '#081C42',
            fontSize: '1rem',
            mb: 2,
          }}
        >
          Active Scenarios
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {demoData.scenarios.map((scenario: any) => (
            <Grid item xs={12} md={6} key={scenario.scenario_id}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2.5, 
                  bgcolor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    borderColor: '#d1d5db',
                  },
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 600,
                        color: '#081C42',
                        mb: 0.5,
                      }}
                    >
                      {scenario.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                      }}
                    >
                      {scenario.description}
                    </Typography>
                  </Box>
                  <Chip 
                    label={scenario.status} 
                    size="small"
                    sx={{
                      bgcolor: '#d1fae5',
                      color: '#065f46',
                      fontWeight: 500,
                      ml: 2,
                    }}
                  />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Card>

      {/* Calculations */}
      <Card 
        elevation={0}
        sx={{ 
          p: 3, 
          borderRadius: '8px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          mb: 3,
        }}
      >
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            fontWeight: 600,
            color: '#081C42',
            fontSize: '1rem',
            mb: 2,
          }}
        >
          Recent Calculations
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {demoData.calculations.map((calc: any) => (
            <Grid item xs={12} key={calc.calculation_id}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2.5, 
                  bgcolor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    borderColor: '#d1d5db',
                  },
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 600,
                        color: '#081C42',
                        mb: 0.5,
                      }}
                    >
                      Calculation {calc.calculation_id}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        mb: calc.status === 'completed' && calc.results ? 1 : 0,
                      }}
                    >
                      Scenario: {calc.scenario_id} | Portfolio: {calc.portfolio_id}
                    </Typography>
                    {calc.status === 'completed' && calc.results && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f3f4f6' }}>
                        <Typography 
                          variant="caption" 
                          display="block"
                          sx={{ 
                            color: '#6b7280',
                            fontSize: '0.75rem',
                            mb: 0.5,
                          }}
                        >
                          CET1 Ratio: <strong style={{ color: '#081C42' }}>{(calc.results.basel_iv_calc.cet1_ratio * 100).toFixed(2)}%</strong>
                        </Typography>
                        <Typography 
                          variant="caption" 
                          display="block"
                          sx={{ 
                            color: '#6b7280',
                            fontSize: '0.75rem',
                          }}
                        >
                          LCR: <strong style={{ color: '#081C42' }}>{calc.results.lcr_calc.lcr.toFixed(2)}</strong>
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Chip
                    label={calc.status}
                    size="small"
                    sx={{
                      bgcolor: calc.status === 'completed' ? '#d1fae5' :
                               calc.status === 'running' ? '#dbeafe' : '#f3f4f6',
                      color: calc.status === 'completed' ? '#065f46' :
                             calc.status === 'running' ? '#1e40af' : '#6b7280',
                      fontWeight: 500,
                      ml: 2,
                    }}
                  />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Card>

      {/* Portfolios */}
      <Card 
        elevation={0}
        sx={{ 
          p: 3, 
          borderRadius: '8px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
        }}
      >
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            fontWeight: 600,
            color: '#081C42',
            fontSize: '1rem',
            mb: 2,
          }}
        >
          Portfolios
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {demoData.portfolios.map((portfolio: any) => (
            <Grid item xs={12} md={6} key={portfolio.portfolio_id}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2.5, 
                  bgcolor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    borderColor: '#d1d5db',
                  },
                }}
              >
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    fontWeight: 600,
                    color: '#081C42',
                    mb: 1.5,
                  }}
                >
                  {portfolio.portfolio_name}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      fontSize: '0.875rem',
                    }}
                  >
                    Notional: <strong style={{ color: '#081C42' }}>${(portfolio.total_notional / 1000000).toFixed(0)}M</strong>
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#6b7280',
                      fontSize: '0.875rem',
                    }}
                  >
                    Market Value: <strong style={{ color: '#081C42' }}>${(portfolio.total_market_value / 1000000).toFixed(0)}M</strong>
                  </Typography>
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 2 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#6b7280',
                        fontSize: '0.875rem',
                      }}
                    >
                      RWA: <strong style={{ color: '#081C42' }}>${(portfolio.total_rwa / 1000000).toFixed(0)}M</strong>
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#6b7280',
                        fontSize: '0.875rem',
                      }}
                    >
                      Positions: <strong style={{ color: '#081C42' }}>{portfolio.position_count}</strong>
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Card>
    </Box>
  );
}

