import { Box, Typography, AppBar, Toolbar } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function BrandHeader() {
  const { t } = useTranslation();

  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{ 
        background: 'transparent',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Toolbar sx={{ minHeight: '64px !important', px: 4 }}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: '0.5px',
              fontSize: '1.25rem',
            }}
          >
            SAA Alliance
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

