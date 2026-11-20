import { act, fireEvent, render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { supabase } from './supabaseClient';

jest.mock('./supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('./components/Avatar3D.jsx', () => ({
  __esModule: true,
  default: ({ currentAction }) => require('react').createElement('div', {
    'data-testid': 'dashboard-avatar',
    'data-current-action': currentAction,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows available courses and starts learning only for enrolled courses', async () => {
  const courses = [
    {
      id: 'course-1',
      title: 'Algebra Basics',
      description: 'Learn variables and equations.',
      price: 25,
      syllabus_text: 'Variables, equations, and expressions.',
    },
    {
      id: 'course-2',
      title: 'World History',
      description: 'Explore key events in history.',
      price: 40,
      syllabus_text: 'Ancient history and more.',
    },
  ];
  supabase.from.mockImplementation((table) => (
    table === 'courses'
      ? { select: jest.fn().mockResolvedValue({ data: courses, error: null }) }
      : {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: 'user-1', course_id: 'course-1', has_access: true }],
            error: null,
          }),
        }),
      }
  ));
  const onStartLearning = jest.fn();

  render(
    <Dashboard
      userId="user-1"
      userEmail="learner@example.com"
      preferredName="Abhi"
      onStartLearning={onStartLearning}
    />,
  );

  expect(await screen.findByText('Learn variables and equations.')).toBeInTheDocument();
  expect(screen.getByText('Hi Abhi, what are we learning today?')).toBeInTheDocument();
  expect(screen.getByTestId('dashboard-avatar')).toHaveAttribute('data-current-action', 'idle');
  expect(supabase.from).toHaveBeenCalledWith('courses');
  expect(supabase.from).toHaveBeenCalledWith('enrollments');
  expect(screen.getByRole('button', { name: 'Start Learning' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Locked - Buy for ₹40.00' })).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: 'Start Learning' }));
  expect(onStartLearning).toHaveBeenCalledWith({
    id: 'course-1',
    title: 'Algebra Basics',
    syllabus_text: 'Variables, equations, and expressions.',
  });
});

test('creates an order, verifies payment, and enrolls the user', async () => {
  const course = {
    id: 'course-paid',
    title: 'Paid Algebra',
    description: 'Learn algebra.',
    syllabus_text: 'Numbers and equations.',
    price: 250,
  };
  const insert = jest.fn().mockResolvedValue({ error: null });
  supabase.from.mockImplementation((table) => (
    table === 'courses'
      ? { select: jest.fn().mockResolvedValue({ data: [course], error: null }) }
      : {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert,
      }
  ));
  const open = jest.fn();
  let checkoutOptions;
  window.Razorpay = jest.fn((options) => {
    checkoutOptions = options;
    return { open };
  });
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: 'order-123', keyId: 'rzp_test_public' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ verified: true }),
    });

  render(
    <Dashboard
      userId="user-1"
      userEmail="learner@example.com"
      onStartLearning={jest.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Locked - Buy for ₹250.00' }));

  await screen.findByText('Processing Payment…');
  expect(open).toHaveBeenCalled();
  expect(checkoutOptions).toEqual(expect.objectContaining({
    key: 'rzp_test_public',
    order_id: 'order-123',
    name: 'Bablu Learning',
    description: 'Access to Paid Algebra',
    prefill: { name: 'learner@example.com', email: 'learner@example.com' },
  }));
  expect(global.fetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:5000/api/payment/order',
    expect.objectContaining({
      body: JSON.stringify({ amount: 250, courseId: 'course-paid' }),
    }),
  );

  await act(async () => {
    await checkoutOptions.handler({
      razorpay_order_id: 'order-123',
      razorpay_payment_id: 'payment-456',
      razorpay_signature: 'signature',
    });
  });

  expect(global.fetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:5000/api/payment/verify',
    expect.objectContaining({
      body: JSON.stringify({
        razorpay_order_id: 'order-123',
        razorpay_payment_id: 'payment-456',
        razorpay_signature: 'signature',
        courseId: 'course-paid',
      }),
    }),
  );
  expect(insert).toHaveBeenCalledWith({
    user_id: 'user-1',
    course_id: 'course-paid',
    has_access: true,
  });
  expect(await screen.findByRole('button', { name: 'Start Learning' })).toBeEnabled();
});
