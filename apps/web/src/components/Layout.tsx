import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Avatar,
  Box,
  Button,
  Divider,
  Paper,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import InboxIcon from '@mui/icons-material/Inbox'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../features/auth/useAuth'

const drawerWidth = 260

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { to: '/', label: 'New Search', icon: <SearchIcon /> },
    { to: '/inbox', label: 'Inbox', icon: <InboxIcon /> },
  ]

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Paper
        elevation={0}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          position: 'fixed',
          height: '100vh',
          zIndex: (theme) => theme.zIndex.drawer,
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            LeadFlow
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Discovery pipeline
          </Typography>
        </Box>

        <Box sx={{ px: 2, flexGrow: 1 }}>
          {navItems.map((item) => {
            const active = location.pathname === item.to
            return (
              <Button
                key={item.to}
                component={Link}
                to={item.to}
                startIcon={item.icon}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  px: 2,
                  mb: 1,
                  borderRadius: 2,
                  color: active ? 'primary.main' : 'text.secondary',
                  bgcolor: active ? 'primary.light' : 'transparent',
                  '&:hover': {
                    bgcolor: active ? 'primary.light' : 'action.hover',
                  },
                }}
              >
                {item.label}
              </Button>
            )
          })}
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
              {user?.email.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {user?.email}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="inherit"
            fullWidth
            startIcon={<LogoutIcon />}
            onClick={() => void logout()}
            sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
          >
            Sign out
          </Button>
        </Box>
      </Paper>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${drawerWidth}px`,
          p: { xs: 3, md: 5 },
          maxWidth: `calc(100% - ${drawerWidth}px)`,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
