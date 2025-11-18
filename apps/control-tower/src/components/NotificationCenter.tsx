import { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Button,
  Divider,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import { notificationService, Notification } from '../services/notifications';

export default function NotificationCenter() {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Load notifications
    setNotifications(notificationService.getAll());

    // Subscribe to updates
    const unsubscribe = notificationService.subscribe((notifs) => {
      setNotifications(notifs);
    });

    return unsubscribe;
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const unreadCount = notificationService.getUnreadCount();
  const open = Boolean(anchorEl);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ width: 400, maxHeight: 500 }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              🔔 Notifications
            </Typography>
            {unreadCount > 0 && (
              <Button size="small" onClick={handleMarkAllAsRead}>
                Mark all read
              </Button>
            )}
          </Box>
          <Divider />
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText primary="No notifications" />
              </ListItem>
            ) : (
              notifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  onClick={() => handleMarkAsRead(notification.id)}
                  sx={{
                    bgcolor: notification.read ? 'transparent' : 'action.hover',
                    cursor: 'pointer',
                  }}
                >
                  <ListItemIcon>{getIcon(notification.type)}</ListItemIcon>
                  <ListItemText
                    primary={notification.title}
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          {notification.message}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(notification.timestamp).toLocaleString()}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}

