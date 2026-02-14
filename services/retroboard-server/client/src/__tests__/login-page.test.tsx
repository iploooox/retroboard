import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { useAuthStore } from '../stores/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isSubmitting: false,
      loginError: null,
      registerError: null,
      fieldErrors: {},
    });
    mockNavigate.mockClear();
  });

  const renderLogin = () =>
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );

  const getPasswordInput = () => document.getElementById('password') as HTMLInputElement;

  it('should render login form', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    renderLogin();
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'test123' } });
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    });
  });

  it('should show login error from store', () => {
    useAuthStore.setState({ loginError: 'Invalid email or password' });
    renderLogin();
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
  });

  it('should have tabs linking to register', () => {
    renderLogin();
    const registerTab = screen.getByRole('tab', { name: /register/i });
    expect(registerTab).toBeInTheDocument();
    expect(registerTab.closest('a')).toHaveAttribute('href', '/register');
  });

  it('should have forgot password link', () => {
    renderLogin();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });
});
