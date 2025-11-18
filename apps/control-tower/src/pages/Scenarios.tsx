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
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { scenariosApi, Scenario } from '../services/api';

export default function Scenarios() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: scenarios = [], isLoading, error } = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => scenariosApi.list().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: scenariosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setOpen(false);
      setFormData({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: scenariosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
    },
  });

  const handleOpen = (scenario?: Scenario) => {
    if (scenario) {
      setEditingScenario(scenario);
      setFormData({ name: scenario.name, description: scenario.description || '' });
    } else {
      setEditingScenario(null);
      setFormData({ name: '', description: '' });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingScenario(null);
    setFormData({ name: '', description: '' });
  };

  const handleSubmit = () => {
    if (editingScenario) {
      // Update scenario
      // scenariosApi.update(editingScenario.scenario_id, formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t('scenarios.confirmDelete'))) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusColor = (status?: string) => {
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

  if (error) {
    return (
      <Alert severity="error">
        {t('common.error')}: {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 4, bgcolor: '#0a0e27', minHeight: '100vh', color: '#ffffff' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography 
            variant="h4" 
            gutterBottom 
            sx={{ 
              fontWeight: 600, 
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            📋 Scenarios
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            Manage regulatory stress scenarios and calculation workflows
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          sx={{
            bgcolor: '#d4af37',
            color: '#0a0e27',
            fontWeight: 600,
            '&:hover': {
              bgcolor: '#c9a227',
            },
          }}
        >
          {t('scenarios.create')}
        </Button>
      </Box>

      <Card 
        elevation={0}
        sx={{ 
          borderRadius: '12px',
          background: '#1a1f3a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Created</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scenarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {t('scenarios.noScenarios')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                scenarios.map((scenario) => (
                  <TableRow 
                    key={scenario.scenario_id} 
                    hover
                    sx={{
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }}
                  >
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      <Typography variant="body2" fontWeight={500}>
                        {scenario.name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      <Typography variant="body2">
                        {scenario.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={scenario.status || 'draft'}
                        size="small"
                        sx={{
                          bgcolor: scenario.status === 'active' ? '#d1fae5' : 'rgba(255, 255, 255, 0.1)',
                          color: scenario.status === 'active' ? '#065f46' : 'rgba(255, 255, 255, 0.9)',
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      <Typography variant="caption">
                        {scenario.created_at
                          ? new Date(scenario.created_at).toLocaleDateString()
                          : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpen(scenario)}
                        title={t('scenarios.edit')}
                        sx={{ color: '#d4af37', '&:hover': { bgcolor: 'rgba(212, 175, 55, 0.1)' } }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(scenario.scenario_id)}
                        title={t('scenarios.delete')}
                        sx={{ color: '#f5576c', '&:hover': { bgcolor: 'rgba(245, 87, 108, 0.1)' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title={t('scenarios.run')}
                        sx={{ color: '#d4af37', '&:hover': { bgcolor: 'rgba(212, 175, 55, 0.1)' } }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1f3a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: '#ffffff' }}>
          {editingScenario ? t('scenarios.edit') : t('scenarios.create')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('scenarios.name')}
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#d4af37',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
            }}
          />
          <TextField
            margin="dense"
            label={t('scenarios.description')}
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#d4af37',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button 
            onClick={handleClose}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.name || createMutation.isPending}
            sx={{
              bgcolor: '#d4af37',
              color: '#0a0e27',
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#c9a227',
              },
            }}
          >
            {createMutation.isPending ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
