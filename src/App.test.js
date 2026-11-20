import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import App from './App';
import { supabase } from './supabaseClient';

jest.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('./components/Avatar3D.jsx', () => ({
  __esModule: true,
  default: function MockAvatar3D({ className }) {
    return <div data-testid="avatar-3d" className={className} />;
  },
  AvatarModel: function MockAvatarModel() {
    return <div data-testid="avatar-model" />;
  },
}));

jest.mock('framer-motion', () => {
  const React = require('react');
  const MotionElement = React.forwardRef(({
    animate,
    children,
    onAnimationComplete,
    ...props
  }, ref) => {
    React.useEffect(() => {
      if (animate?.y === '-150vh') {
        onAnimationComplete?.();
      }
    }, [animate, onAnimationComplete]);

    return React.createElement('div', { ...props, ref }, children);
  });

  return {
    AnimatePresence: ({ children }) => children,
    motion: {
      div: MotionElement,
      section: MotionElement,
    },
  };
});

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="classroom-canvas">{children}</div>,
}));

jest.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  Environment: () => null,
  Float: ({ children }) => <div>{children}</div>,
  Stars: () => null,
  Text: ({ children }) => <div>{children}</div>,
}));

let updateProfile;
let persistProfile;
let defaultFrom;
let siteSettingsUpdate;

const createQuery = ({ data = null, listData, error = null } = {}) => {
  const query = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
    single: jest.fn().mockResolvedValue({ data, error }),
    then: (resolve, reject) => Promise.resolve({
      data: listData === undefined
        ? Array.isArray(data) ? data : data ? [data] : []
        : listData,
      error,
    }).then(resolve, reject),
  };
  return query;
};

const createSiteSettingsMock = (isLaunched) => ({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 1, is_launched: isLaunched },
        error: null,
      }),
    }),
  }),
  update: siteSettingsUpdate,
});

const mockSupabaseTables = (handler, isLaunched = true) => {
  supabase.from.mockImplementation((table, ...args) => (
    table === 'site_settings'
      ? createSiteSettingsMock(isLaunched)
      : handler(table, ...args)
  ));
};

afterEach(() => {
  jest.useRealTimers();
  delete window.webkitSpeechRecognition;
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
  window.history.replaceState({}, '', '/');
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.removeItem('theme');
  window.history.replaceState({}, '', '/login');
  const profileQuery = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        username: 'abhi@example.com',
        preferred_name: 'Abhi',
        xp: 30,
      },
      error: null,
    }),
  };
  updateProfile = jest.fn().mockResolvedValue({ error: null });
  persistProfile = jest.fn().mockReturnValue({ eq: updateProfile });
  siteSettingsUpdate = jest.fn().mockImplementation(({ is_launched }) => ({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { is_launched },
          error: null,
        }),
      }),
    }),
  }));
  defaultFrom = () => ({
    select: jest.fn().mockReturnValue(profileQuery),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: persistProfile,
  });
  mockSupabaseTables(defaultFrom);
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1', email: 'abhi@example.com' } } },
    error: null,
  });
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
});

test('shows the launch gate at the root for a non-admin user while offline', async () => {
  mockSupabaseTables(defaultFrom, false);
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'user-1', email: 'learner@example.com' } } },
    error: null,
  });
  window.history.replaceState({}, '', '/');

  render(<App />);

  expect(await screen.findByRole('button', { name: 'Initiate Launch' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Coming Soon' })).not.toBeInTheDocument();
});

test('redirects non-admin routes to the launch gate while the site is offline', async () => {
  mockSupabaseTables(defaultFrom, false);
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'user-1', email: 'learner@example.com' } } },
    error: null,
  });
  window.history.replaceState({}, '', '/login');

  render(<App />);

  expect(await screen.findByRole('button', { name: 'Initiate Launch' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Coming Soon' })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});

test('shows the normal landing page to everyone when the site is live', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
  window.history.replaceState({}, '', '/');

  render(<App />);

  expect(await screen.findByRole('heading', {
    name: 'Master Job-Ready Skills with your AI Tutor.',
  })).toBeInTheDocument();
});

test('allows a non-admin to launch the website while it is offline', async () => {
  jest.useFakeTimers();
  mockSupabaseTables(defaultFrom, false);
  supabase.auth.getSession.mockResolvedValueOnce({
    data: {
      session: {
        user: { id: 'user-1', email: 'learner@example.com' },
      },
    },
    error: null,
  });
  window.history.replaceState({}, '', '/');

  render(<App />);
  await act(async () => {
    await Promise.resolve();
  });

  fireEvent.click(screen.getByRole('button', { name: 'Initiate Launch' }));
  expect(screen.getByLabelText('Countdown 3')).toBeInTheDocument();

  for (let second = 0; second < 3; second += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
  }

  expect(siteSettingsUpdate).toHaveBeenCalledWith({ is_launched: true });
  await waitFor(() => {
    expect(window.location.pathname).toBe('/dashboard');
  });
});

test('toggles the theme and restores the saved preference on remount', async () => {
  const { unmount } = render(<App />);

  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
  expect(screen.getByText(
    'Hi Abhi, what are we learning today?',
  )).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveClass('dark-mode');
  expect(screen.queryByLabelText(/preferred name/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Toggle Theme' }));

  expect(screen.getByRole('main')).toHaveClass('light-mode');
  expect(localStorage.getItem('theme')).toBe('light');

  unmount();
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveClass('light-mode');
});

test.each([
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms of Service'],
  ['/refund', 'Refund Policy'],
])('serves the %s legal page without requiring sign-in', async (path, title) => {
  window.history.replaceState({}, '', path);

  render(<App />);

  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to the app' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    /Privacy Policy\s*\|\s*Terms of Service\s*\|\s*Refund Policy/,
  );
});

test('renders the 3D avatar in the login layout', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
  render(<App />);

  const avatar = await screen.findByTestId('avatar-3d');
  expect(avatar).toHaveClass('avatar-3d-container');
  expect(avatar.parentElement).toHaveClass('avatar-pod');
});

test('signs in and shows the course dashboard', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });

  supabase.auth.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: 'user-1', email: 'abhi@example.com' } } },
    error: null,
  });

  render(<App />);

  fireEvent.change(await screen.findByLabelText(/email/i), {
    target: { value: 'abhi@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));

  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'abhi@example.com',
    password: 'password123',
  });
});

test('toggles password visibility', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
  render(<App />);

  const passwordInput = await screen.findByLabelText(/^password$/i);
  expect(passwordInput).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(passwordInput).toHaveAttribute('type', 'text');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(passwordInput).toHaveAttribute('type', 'password');
});

test('sends a password reset email', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  render(<App />);

  fireEvent.change(await screen.findByLabelText(/^email$/i), {
    target: { value: 'abhi@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Forgot Password?' }));

  expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

  expect(await screen.findByText('Password reset link sent to your email!')).toBeInTheDocument();
  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    'abhi@example.com',
    { redirectTo: 'http://localhost:3000/update-password' },
  );
  expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
});

test('does not insert a profile when an authenticated user has no profile', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: {
      session: {
        user: {
          id: 'user-1',
          email: 'abhi@example.com',
          user_metadata: {
            first_name: 'Abhinav',
            last_name: 'Kumar',
            preferred_name: 'Abhi',
            username: 'abhi_k',
          },
        },
      },
    },
    error: null,
  });
  const profileQuery = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  const insert = jest.fn().mockResolvedValue({ error: null });
  mockSupabaseTables((table) => (
    table === 'profiles'
      ? { select: jest.fn().mockReturnValue(profileQuery), insert }
      : {
        select: jest.fn().mockReturnValue(
          table === 'enrollments'
            ? { eq: jest.fn().mockResolvedValue({ data: [], error: null }) }
            : Promise.resolve({ data: [], error: null }),
        ),
      }
  ));

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
  expect(screen.getByText('Hi friend, what are we learning today?')).toBeInTheDocument();
  expect(profileQuery.eq).toHaveBeenCalledWith('id', 'user-1');
  expect(insert).not.toHaveBeenCalled();
});

test('shows profile load errors without attempting an insert', async () => {
  const profileQuery = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Profile query denied' },
    }),
  };
  const insert = jest.fn();
  mockSupabaseTables(() => ({
    select: jest.fn().mockReturnValue(profileQuery),
    insert,
  }));

  render(<App />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load your profile: Profile query denied',
  );
  expect(insert).not.toHaveBeenCalled();
});

test('signs up and explains email confirmation when no session is returned', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
  supabase.auth.signUp.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  render(<App />);

  fireEvent.click(await screen.findByRole('tab', { name: 'Sign Up' }));
  expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/preferred name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText(/email/i), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: 'Abhinav' },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: 'Kumar' },
  });
  fireEvent.change(screen.getByLabelText(/preferred name/i), {
    target: { value: 'Abhi' },
  });
  fireEvent.change(screen.getByLabelText(/^username$/i), {
    target: { value: 'abhi_k' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Account created. Check your email to confirm it, then log in.',
  );
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: 'new@example.com',
    password: 'password123',
    options: {
      data: {
        first_name: 'Abhinav',
        last_name: 'Kumar',
        preferred_name: 'Abhi',
        username: 'abhi_k',
      },
    },
  });
});

test('does not submit signup when passwords do not match', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
  render(<App />);

  fireEvent.click(await screen.findByRole('tab', { name: 'Sign Up' }));
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: 'Abhinav' },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: 'Kumar' },
  });
  fireEvent.change(screen.getByLabelText(/preferred name/i), {
    target: { value: 'Abhi' },
  });
  fireEvent.change(screen.getByLabelText(/^username$/i), {
    target: { value: 'abhi_k' },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'abhi@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'different123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

test('logs out and returns to the login page', async () => {
  supabase.auth.signOut.mockResolvedValue({ error: null });
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: /log out/i }));

  expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(supabase.auth.signOut).toHaveBeenCalled();
});

test('shows the admin dashboard only to the configured admin email', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({
    data: {
      session: {
        user: { id: 'admin-1', email: 'authenticationdietapp@gmail.com' },
      },
    },
    error: null,
  });

  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Admin Panel' }));

  expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Back to Chat' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to Chat' }));
  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
});

test('does not show the admin panel button to other users', async () => {
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Admin Panel' })).not.toBeInTheDocument();
});

test('creates a missing profile before showing an enrolled learning route', async () => {
  window.history.replaceState({}, '', '/learn/course-1');
  const course = {
    id: 'course-1',
    title: 'Algebra Basics',
    syllabus_text: 'Variables and equations.',
  };
  const profile = {
    id: 'user-1',
    username: 'abhi@example.com',
    preferred_name: 'Abhi',
    xp: 0,
  };
  const profileQuery = createQuery({ data: profile });
  profileQuery.maybeSingle
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: profile, error: null });
  const insertProfile = jest.fn().mockResolvedValue({ error: null });
  const enrollment = { user_id: 'user-1', course_id: 'course-1', has_access: true };

  mockSupabaseTables((table) => {
    if (table === 'profiles') {
      return {
        select: jest.fn().mockReturnValue(profileQuery),
        insert: insertProfile,
      };
    }
    if (table === 'enrollments') {
      return {
        select: jest.fn().mockReturnValue(createQuery({
          data: enrollment,
          listData: [enrollment],
        })),
      };
    }
    if (table === 'courses') {
      return {
        select: jest.fn().mockReturnValue(createQuery({
          data: course,
          listData: [course],
        })),
      };
    }
    return {};
  });

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Algebra Basics' })).toBeInTheDocument();
  expect(insertProfile).toHaveBeenCalledWith({
    id: 'user-1',
    username: 'abhi@example.com',
    xp: 0,
  });
  expect(window.location.pathname).toBe('/learn/course-1');
});

test('redirects a user without active course access to the dashboard', async () => {
  window.history.replaceState({}, '', '/learn/course-1');
  const profileQuery = createQuery({ data: {
    id: 'user-1',
    username: 'abhi@example.com',
    preferred_name: 'Abhi',
    xp: 0,
  } });

  mockSupabaseTables((table) => {
    if (table === 'profiles') {
      return { select: jest.fn().mockReturnValue(profileQuery) };
    }
    if (table === 'enrollments') {
      return { select: jest.fn().mockReturnValue(createQuery()) };
    }
    if (table === 'courses') {
      return { select: jest.fn().mockReturnValue(createQuery({ listData: [] })) };
    }
    return {};
  });

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/dashboard');
  expect(screen.queryByRole('heading', { name: 'Algebra Basics' })).not.toBeInTheDocument();
});

test('uses the profile username when the preferred name is empty', async () => {
  mockSupabaseTables((table) => {
    if (table === 'profiles') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              username: 'abhi_k',
              preferred_name: '',
              xp: 0,
            },
            error: null,
          }),
        }),
      };
    }
    if (table === 'courses') {
      return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
    }
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
  });

  render(<App />);

  expect(await screen.findByText(
    'Hi abhi_k, what are we learning today?',
  )).toBeInTheDocument();
});

test('sends a message to Bablu and displays the dialogue', async () => {
  const course = {
    id: 'course-1',
    title: 'Algebra Basics',
    description: 'Learn algebra.',
    syllabus_text: 'Variables and equations.',
    price: 29,
  };
  mockSupabaseTables((table) => {
    if (table === 'profiles') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              username: 'abhi@example.com',
              preferred_name: 'Abhi',
              xp: 30,
            },
            error: null,
          }),
        }),
        update: persistProfile,
      };
    }
    if (table === 'courses') {
      return {
        select: jest.fn().mockImplementation(() => {
          const query = Promise.resolve({ data: [course], error: null });
          query.eq = jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: course, error: null }),
          });
          return query;
        }),
      };
    }
    const enrollment = { user_id: 'user-1', course_id: 'course-1', has_access: true };
    return {
      select: jest.fn().mockReturnValue(createQuery({
        data: enrollment,
        listData: [enrollment],
      })),
    };
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ dialogue: 'What would you like to explore?', xp_change: 10 }),
  });

  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Start Learning' }));
  expect(window.location.pathname).toBe('/learn/course-1');
  expect(await screen.findByRole('heading', { name: 'Algebra Basics' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/your message/i), {
    target: { value: 'Help me study science' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send/i }));

  expect(await screen.findByText(/Bablu: What would you like to explore\?/)).toBeInTheDocument();
  expect(screen.getByText('Currently Learning: Algebra Basics')).toBeInTheDocument();
  expect(screen.getByText('40 / 100')).toBeInTheDocument();
  expect(persistProfile).toHaveBeenCalledWith({ xp: 40 });
  expect(updateProfile).toHaveBeenCalledWith('id', 'user-1');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/api/chat',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatHistory: [
          {
            role: 'system',
            content: 'The learner is studying the course "Algebra Basics". Use this syllabus to keep your tutoring relevant to the course:\nVariables and equations.',
          },
          { role: 'user', content: 'Help me study science' },
        ],
        userMessage: 'Help me study science',
        userName: 'Abhi',
        userQuota: 8,
        courseTitle: 'Algebra Basics',
        courseSyllabus: 'Variables and equations.',
      }),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
  expect(await screen.findByRole('heading', { name: 'Explore Courses' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
});

test('automatically sends recognized speech, speaks replies with a preferred voice, and cancels speech on send', async () => {
  let recognition;
  class SpeechRecognitionMock {
    constructor() {
      recognition = this;
    }

    start() {
      this.onstart();
    }

    stop() {
      this.onend();
    }
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', {
    configurable: true,
    value: SpeechRecognitionMock,
  });

  const utterances = [];
  function SpeechSynthesisUtteranceMock(text) {
    this.text = text;
    utterances.push(this);
  }
  const speechSynthesis = {
    cancel: jest.fn(),
    speak: jest.fn(),
    getVoices: jest.fn().mockReturnValue([
      { name: 'Google UK English Female', lang: 'en-GB' },
      { name: 'English Voice', lang: 'en-US' },
    ]),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: SpeechSynthesisUtteranceMock,
  });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: speechSynthesis,
  });

  const course = {
    id: 'course-1',
    title: 'Algebra Basics',
    description: 'Learn algebra.',
    syllabus_text: 'Variables and equations.',
    price: 29,
  };
  mockSupabaseTables((table) => {
    if (table === 'profiles') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              username: 'abhi@example.com',
              preferred_name: 'Abhi',
              xp: 30,
            },
            error: null,
          }),
        }),
        update: persistProfile,
      };
    }
    if (table === 'courses') {
      return {
        select: jest.fn().mockImplementation(() => {
          const query = Promise.resolve({ data: [course], error: null });
          query.eq = jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: course, error: null }),
          });
          return query;
        }),
      };
    }
    const enrollment = { user_id: 'user-1', course_id: 'course-1', has_access: true };
    return {
      select: jest.fn().mockReturnValue(createQuery({
        data: enrollment,
        listData: [enrollment],
      })),
    };
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ dialogue: 'Let us solve it together.', xp_change: 0 }),
  });

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Learning' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Start voice input' }));

  expect(await screen.findByRole('button', { name: 'Stop voice input' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(recognition).toBeDefined();
  act(() => {
    recognition.onresult({
      results: [[{ transcript: 'Explain this equation' }]],
    });
  });

  expect(await screen.findByText(/Bablu:\s*Let us solve it together\./)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).userMessage).toBe(
    'Explain this equation',
  );
  expect(speechSynthesis.speak).toHaveBeenCalled();
  const spokenReply = utterances[utterances.length - 1];
  expect(spokenReply.text).toBe('Let us solve it together.');
  expect(spokenReply.voice.name).toBe('Google UK English Female');

  const cancelCount = speechSynthesis.cancel.mock.calls.length;
  fireEvent.change(screen.getByLabelText(/your message/i), {
    target: { value: 'Another question' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send/i }));
  expect(speechSynthesis.cancel).toHaveBeenCalledTimes(cancelCount + 1);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
});
