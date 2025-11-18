import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { portfoliosApi } from '../services/api';
import { formatCurrency } from '../utils/format';

export default function Portfolios() {
  const { t } = useTranslation();

  const { data: portfolios = [], isLoading, error } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => portfoliosApi.list().then((res) => res.data),
  });

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

  const totalNotional = portfolios.reduce((sum, p) => sum + p.total_notional, 0);
  const totalMarketValue = portfolios.reduce((sum, p) => sum + p.total_market_value, 0);
  const totalRWA = portfolios.reduce((sum, p) => sum + p.total_rwa, 0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('common.portfolios')}
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Notional
              </Typography>
              <Typography variant="h5">{formatCurrency(totalNotional)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Market Value
              </Typography>
              <Typography variant="h5">{formatCurrency(totalMarketValue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total RWA
              </Typography>
              <Typography variant="h5">{formatCurrency(totalRWA)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Portfolio ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>As of Date</TableCell>
              <TableCell align="right">Notional</TableCell>
              <TableCell align="right">Market Value</TableCell>
              <TableCell align="right">RWA</TableCell>
              <TableCell align="right">Positions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {portfolios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No portfolios found
                </TableCell>
              </TableRow>
            ) : (
              portfolios.map((portfolio) => (
                <TableRow key={portfolio.portfolio_id} hover>
                  <TableCell>{portfolio.portfolio_id}</TableCell>
                  <TableCell>{portfolio.portfolio_name}</TableCell>
                  <TableCell>
                    {new Date(portfolio.as_of_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(portfolio.total_notional)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(portfolio.total_market_value)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(portfolio.total_rwa)}
                  </TableCell>
                  <TableCell align="right">{portfolio.position_count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
