import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../pages/RegisterPage';
import { useAuthStore } from '../stores/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('RegisterPage', () => {
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

  const renderRegister = () =>
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>,
    );

  const getPasswordInput = () => document.getElementById('register-password') as HTMLInputElement;

  it('should render registration form', () => {
    renderRegister();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should show password requirements hint', () => {
    renderRegister();
    expect(screen.getByText(/min 8 chars/i)).toBeInTheDocument();
  });

  it('should validate empty display name', async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'StrongPass1' } });

    // Use form submit event directly to bypass native required validation in jsdom
    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Display name is required')).toBeInTheDocument();
    });
  });

  it('should validate weak password', async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'weak' } });

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('should validate password complexity', async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'alllowercase' } });

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/must contain an uppercase letter/i)).toBeInTheDocument();
    });
  });

  it('should show email exists error from store', () => {
    useAuthStore.setState({ fieldErrors: { email: 'An account with this email already exists' } });
    renderRegister();
    expect(screen.getByText('An account with this email already exists')).toBeInTheDocument();
  });
});
