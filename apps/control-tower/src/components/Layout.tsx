import { ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CalculateIcon from '@mui/icons-material/Calculate';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { Link, useLocation } from 'react-router-dom';
import NotificationCenter from './NotificationCenter';
import { notificationService } from '../services/notifications';

const drawerWidth = 240;

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    // Connect notification service (disabled in simple mode)
    // WebSocket is not available in the simplified API Gateway
    // const token = localStorage.getItem('token');
    // if (token) {
    //   notificationService.connect(
    //     token,
    //     import.meta.env.VITE_WS_URL || 'http://localhost:9002'
    //   );
    // }
  }, []);

  const menuItems = [
    { path: '/', label: `📊 ${t('common.dashboard')}`, icon: <DashboardIcon /> },
    { path: '/demo', label: `🎯 Demo`, icon: <DashboardIcon /> },
    { path: '/scenarios', label: `📋 ${t('common.scenarios')}`, icon: <AssessmentIcon /> },
    { path: '/calculations', label: `⚡ ${t('common.calculations')}`, icon: <CalculateIcon /> },
    { path: '/portfolios', label: `💼 ${t('common.portfolios')}`, icon: <AccountBalanceIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'transparent',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important', px: 4 }}>
          <Typography 
            variant="h6" 
            noWrap 
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
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            background: '#1a1f3a',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', background: '#1a1f3a' }}>
          <List>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    selected={isActive}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(212, 175, 55, 0.15)',
                        borderLeft: '3px solid #d4af37',
                        color: '#ffffff',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: isActive ? '#d4af37' : 'rgba(255, 255, 255, 0.6)' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label}
                      primaryTypographyProps={{
                        sx: {
                          fontSize: '0.875rem',
                          fontWeight: isActive ? 600 : 400,
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 0,
          bgcolor: '#0a0e27',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

