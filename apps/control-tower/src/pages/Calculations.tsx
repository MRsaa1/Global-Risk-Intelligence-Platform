import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { calculationsApi, scenariosApi, portfoliosApi, Calculation } from '../services/api';

export default function Calculations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ scenario_id: '', portfolio_id: '' });

  const { data: calculations = [], isLoading } = useQuery({
    queryKey: ['calculations'],
    queryFn: () => calculationsApi.list().then((res) => res.data),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => scenariosApi.list().then((res) => res.data),
  });

  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => portfoliosApi.list().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: calculationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculations'] });
      setOpen(false);
      setFormData({ scenario_id: '', portfolio_id: '' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: calculationsApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculations'] });
    },
  });

  const handleOpen = () => {
    setFormData({ scenario_id: '', portfolio_id: '' });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({ scenario_id: '', portfolio_id: '' });
  };

  const handleSubmit = () => {
    if (formData.scenario_id && formData.portfolio_id) {
      createMutation.mutate(formData);
    }
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate(id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const runningCount = calculations.filter((c) => c.status === 'running').length;
  const completedCount = calculations.filter((c) => c.status === 'completed').length;
  const failedCount = calculations.filter((c) => c.status === 'failed').length;

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#667eea' }}>
            ⚡ Calculations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and manage regulatory risk calculations
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['calculations'] })}
            sx={{ mr: 1 }}
          >
            {t('common.refresh')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpen}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {t('calculations.create')}
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Box display="flex" gap={2} mb={3}>
        <Card sx={{ flex: 1, p: 2, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
          <Typography variant="h4" fontWeight={700}>{runningCount}</Typography>
          <Typography variant="caption">Running</Typography>
        </Card>
        <Card sx={{ flex: 1, p: 2, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
          <Typography variant="h4" fontWeight={700}>{completedCount}</Typography>
          <Typography variant="caption">Completed</Typography>
        </Card>
        <Card sx={{ flex: 1, p: 2, background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
          <Typography variant="h4" fontWeight={700}>{failedCount}</Typography>
          <Typography variant="caption">Failed</Typography>
        </Card>
      </Box>

      <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('calculations.scenario')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('calculations.portfolio')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('calculations.status')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Completed</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calculations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('calculations.noCalculations')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                calculations.map((calc) => (
                  <TableRow key={calc.calculation_id} hover>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace">
                        {calc.calculation_id.substring(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell>{calc.scenario_id}</TableCell>
                    <TableCell>{calc.portfolio_id}</TableCell>
                    <TableCell>
                      <Chip
                        label={calc.status}
                        color={getStatusColor(calc.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {calc.created_at
                          ? new Date(calc.created_at).toLocaleString()
                          : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {calc.completed_at
                          ? new Date(calc.completed_at).toLocaleString()
                          : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {calc.status === 'running' && (
                        <IconButton
                          size="small"
                          onClick={() => handleCancel(calc.calculation_id)}
                          title={t('calculations.cancel')}
                          color="error"
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      )}
                      {calc.status === 'completed' && (
                        <IconButton
                          size="small"
                          title="View Results"
                          color="primary"
                          onClick={() => window.location.href = `/calculations/${calc.calculation_id}`}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {t('calculations.create')}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>{t('calculations.scenario')}</InputLabel>
            <Select
              value={formData.scenario_id}
              onChange={(e) =>
                setFormData({ ...formData, scenario_id: e.target.value })
              }
              label={t('calculations.scenario')}
            >
              {scenarios.map((scenario) => (
                <MenuItem key={scenario.scenario_id} value={scenario.scenario_id}>
                  {scenario.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>{t('calculations.portfolio')}</InputLabel>
            <Select
              value={formData.portfolio_id}
              onChange={(e) =>
                setFormData({ ...formData, portfolio_id: e.target.value })
              }
              label={t('calculations.portfolio')}
            >
              {portfolios.map((portfolio) => (
                <MenuItem key={portfolio.portfolio_id} value={portfolio.portfolio_id}>
                  {portfolio.portfolio_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !formData.scenario_id ||
              !formData.portfolio_id ||
              createMutation.isPending
            }
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {createMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              t('common.create')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
