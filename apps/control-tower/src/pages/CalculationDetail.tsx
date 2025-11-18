import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Paper,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { calculationsApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatCurrency, formatPercentage } from '../utils/format';

export default function CalculationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [calculation, setCalculation] = useState<any>(null);

  const token = localStorage.getItem('token');

  const { data, isLoading, error } = useQuery({
    queryKey: ['calculation', id],
    queryFn: () => calculationsApi.get(id!).then((res) => res.data),
    enabled: !!id,
    refetchInterval: 5000,
  });

  // WebSocket for real-time updates
  useWebSocket(
    import.meta.env.VITE_WS_URL || 'http://localhost:9002',
    token,
    (update) => {
      if (update.calculation_id === id) {
        setCalculation(update);
        // Refetch data
        // queryClient.invalidateQueries(['calculation', id]);
      }
    }
  );

  useEffect(() => {
    if (data) {
      setCalculation(data);
    }
  }, [data]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !calculation) {
    return (
      <Alert severity="error">
        Calculation not found
      </Alert>
    );
  }

  const results = calculation.results || {};
  const baselResults = results.basel_iv_calc || {};
  const lcrResults = results.lcr_calc || {};

  // Chart data
  const capitalData = [
    { name: 'CET1', value: baselResults.cet1 || 0 },
    { name: 'Tier 1', value: (baselResults.cet1 || 0) * 1.1 },
    { name: 'Total Capital', value: (baselResults.cet1 || 0) * 1.2 },
  ];

  const complianceData = [
    { metric: 'CET1 Ratio', value: (baselResults.cet1_ratio || 0) * 100, threshold: 4.5 },
    { metric: 'LCR', value: (lcrResults.lcr || 0) * 100, threshold: 100 },
  ];

  const COLORS = ['#667eea', '#f5576c', '#4facfe', '#43e97b'];

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/calculations')}
        >
          Back
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#667eea' }}>
          📊 Calculation Results
        </Typography>
        <Chip
          label={calculation.status}
          color={
            calculation.status === 'completed'
              ? 'success'
              : calculation.status === 'running'
              ? 'info'
              : 'error'
          }
        />
        {calculation.status === 'completed' && (
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={async () => {
                try {
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9002';
                  const response = await fetch(`${apiUrl}/api/v1/reports/export`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({
                      calculation_id: calculation.calculation_id,
                      format: 'pdf',
                    }),
                  });
                  const data = await response.json();
                  if (data.download_url) {
                    window.open(`${apiUrl}${data.download_url}`, '_blank');
                  }
                } catch (error) {
                  console.error('Export error:', error);
                }
              }}
            >
              Export PDF
            </Button>
            <Button
              variant="outlined"
              startIcon={<TableChartIcon />}
              onClick={async () => {
                try {
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9002';
                  const response = await fetch(`${apiUrl}/api/v1/reports/export`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({
                      calculation_id: calculation.calculation_id,
                      format: 'excel',
                    }),
                  });
                  const data = await response.json();
                  if (data.download_url) {
                    window.open(`${apiUrl}${data.download_url}`, '_blank');
                  }
                } catch (error) {
                  console.error('Export error:', error);
                }
              }}
            >
              Export Excel
            </Button>
          </Box>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="📈 Overview" />
        <Tab label="📊 Basel IV" />
        <Tab label="💧 Liquidity" />
        <Tab label="📋 Details" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, borderRadius: 2, boxShadow: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Capital Structure
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={capitalData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {capitalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, borderRadius: 2, boxShadow: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Compliance Metrics
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#667eea" name="Current" />
                  <Bar dataKey="threshold" fill="#f5576c" name="Threshold" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ p: 3, borderRadius: 2, boxShadow: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Key Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight={700} color="primary.contrastText">
                      {formatPercentage(baselResults.cet1_ratio || 0)}
                    </Typography>
                    <Typography variant="caption" color="primary.contrastText">
                      CET1 Ratio
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight={700} color="success.contrastText">
                      {formatCurrency(baselResults.capital_surplus || 0)}
                    </Typography>
                    <Typography variant="caption" color="success.contrastText">
                      Capital Surplus
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.light', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight={700} color="info.contrastText">
                      {lcrResults.lcr?.toFixed(2) || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="info.contrastText">
                      LCR
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
                    <Typography variant="h5" fontWeight={700} color="warning.contrastText">
                      {formatCurrency(baselResults.rwa || 0)}
                    </Typography>
                    <Typography variant="caption" color="warning.contrastText">
                      RWA
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Card sx={{ p: 3, borderRadius: 2, boxShadow: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Basel IV Results
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Metric</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>CET1 Ratio</TableCell>
                  <TableCell align="right">{formatPercentage(baselResults.cet1_ratio || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Capital Requirement</TableCell>
                  <TableCell align="right">{formatCurrency(baselResults.capital_requirement || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Capital Surplus</TableCell>
                  <TableCell align="right">{formatCurrency(baselResults.capital_surplus || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Risk-Weighted Assets</TableCell>
                  <TableCell align="right">{formatCurrency(baselResults.rwa || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ p: 3, borderRadius: 2, boxShadow: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Liquidity Metrics
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Metric</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>LCR</TableCell>
                  <TableCell align="right">{lcrResults.lcr?.toFixed(2) || 'N/A'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>High Quality Liquid Assets</TableCell>
                  <TableCell align="right">{formatCurrency(lcrResults.hqla || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Net Cash Outflows (30d)</TableCell>
                  <TableCell align="right">{formatCurrency(lcrResults.net_cash_outflows_30d || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Meets Requirement</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={lcrResults.meets_requirement ? 'Yes' : 'No'}
                      color={lcrResults.meets_requirement ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 3 && (
        <Card sx={{ p: 3, borderRadius: 2, boxShadow: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Calculation Details
          </Typography>
          <Box component="pre" sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, overflow: 'auto' }}>
            {JSON.stringify(calculation, null, 2)}
          </Box>
        </Card>
      )}
    </Box>
  );
}

