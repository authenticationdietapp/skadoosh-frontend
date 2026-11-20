import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Admin from './Admin';
import { supabase } from './supabaseClient';

jest.mock('./supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      resetPasswordForEmail: jest.fn(),
    },
    storage: {
      from: jest.fn(),
    },
  },
}));

let siteSettingsUpdate;

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

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  supabase.storage.from.mockReturnValue({
    upload: jest.fn().mockResolvedValue({
      data: { path: 'cover-images/cover.png' },
      error: null,
    }),
    getPublicUrl: jest.fn().mockReturnValue({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/course-covers/cover.png' },
    }),
  });
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
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('loads users, courses, and enrollments and inserts a course-specific grant', async () => {
  const insert = jest.fn().mockResolvedValue({ error: null });
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com', xp: 45 }]
        : table === 'courses'
          ? [{ id: 'course-1', title: 'Algebra Basics', price: 19.99 }]
          : [],
      error: null,
    }),
    insert,
  }));

  render(<Admin onBack={jest.fn()} />);

  expect(await screen.findByText('learner@example.com')).toBeInTheDocument();
  expect(screen.getByText('45')).toBeInTheDocument();
  expect(supabase.from).toHaveBeenCalledWith('profiles');
  expect(supabase.from).toHaveBeenCalledWith('courses');
  expect(supabase.from).toHaveBeenCalledWith('enrollments');

  expect(screen.getByText('Total Paid Users').nextElementSibling).toHaveTextContent('0');
  fireEvent.click(screen.getByRole('button', { name: 'Manage Access' }));
  fireEvent.click(await screen.findByRole('checkbox', {
    name: 'Grant access to Algebra Basics for learner@example.com',
  }));

  expect(insert).toHaveBeenCalledWith({
    user_id: 'user-1',
    course_id: 'course-1',
    has_access: true,
  });
  expect(await screen.findByRole('checkbox', {
    name: 'Revoke access to Algebra Basics for learner@example.com',
  })).toBeChecked();
  expect(screen.getByText('Total Paid Users').nextElementSibling).toHaveTextContent('1');
  expect(screen.getByText('Total Revenue').nextElementSibling).toHaveTextContent('₹19.99');
});

test('shows and toggles the website launch status', async () => {
  const onLaunchStatusChange = jest.fn();
  mockSupabaseTables(() => ({
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
  }), true);

  render(<Admin onBack={jest.fn()} onLaunchStatusChange={onLaunchStatusChange} />);

  expect(await screen.findByText(/Website Launch Status:/)).toHaveTextContent('LIVE');
  fireEvent.click(screen.getByRole('button', { name: 'Set OFFLINE' }));

  await waitFor(() => {
    expect(screen.getByText(/Website Launch Status:/)).toHaveTextContent('OFFLINE');
  });
  expect(siteSettingsUpdate).toHaveBeenCalledWith({ is_launched: false });
  expect(onLaunchStatusChange).toHaveBeenCalledWith(false);
});

test('updates an existing enrollment to grant access', async () => {
  const filterByCourse = jest.fn().mockResolvedValue({ error: null });
  const filterByUser = jest.fn().mockReturnValue({ eq: filterByCourse });
  const update = jest.fn().mockReturnValue({ eq: filterByUser });
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com', xp: 45 }]
        : table === 'courses'
          ? [{ id: 'course-1', title: 'Algebra Basics' }]
          : [{ user_id: 'user-1', course_id: 'course-1', has_access: false }],
      error: null,
    }),
    update,
  }));

  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Manage Access' }));
  fireEvent.click(await screen.findByRole('checkbox', {
    name: 'Grant access to Algebra Basics for learner@example.com',
  }));

  expect(update).toHaveBeenCalledWith({ has_access: true });
  expect(filterByUser).toHaveBeenCalledWith('user_id', 'user-1');
  expect(filterByCourse).toHaveBeenCalledWith('course_id', 'course-1');
  expect(await screen.findByRole('checkbox', {
    name: 'Revoke access to Algebra Basics for learner@example.com',
  })).toBeChecked();
});

test('shows an error when a course access grant fails', async () => {
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com', xp: 45 }]
        : table === 'courses'
          ? [{ id: 'course-1', title: 'Algebra Basics' }]
          : [],
      error: null,
    }),
    insert: jest.fn().mockResolvedValue({ error: { message: 'Permission denied' } }),
  }));

  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Manage Access' }));
  fireEvent.click(await screen.findByRole('checkbox', {
    name: 'Grant access to Algebra Basics for learner@example.com',
  }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not grant access to Algebra Basics: Permission denied',
  );
});

test('revokes an existing enrollment when its access checkbox is cleared', async () => {
  const deleteByCourse = jest.fn().mockResolvedValue({ error: null });
  const filterByUser = jest.fn().mockReturnValue({ eq: deleteByCourse });
  const removeEnrollment = jest.fn().mockReturnValue({ eq: filterByUser });
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com' }]
        : table === 'courses'
          ? [{ id: 'course-1', title: 'Algebra Basics', price: 20 }]
          : [{ user_id: 'user-1', course_id: 'course-1', has_access: true }],
      error: null,
    }),
    delete: removeEnrollment,
  }));

  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Manage Access' }));
  fireEvent.click(await screen.findByRole('checkbox', {
    name: 'Revoke access to Algebra Basics for learner@example.com',
  }));

  expect(removeEnrollment).toHaveBeenCalled();
  expect(filterByUser).toHaveBeenCalledWith('user_id', 'user-1');
  expect(deleteByCourse).toHaveBeenCalledWith('course_id', 'course-1');
  expect(await screen.findByRole('checkbox', {
    name: 'Grant access to Algebra Basics for learner@example.com',
  })).not.toBeChecked();
});

test('sends a password reset email to the selected user', async () => {
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com' }]
        : [],
      error: null,
    }),
  }));

  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reset Password' }));

  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    'learner@example.com',
    { redirectTo: `${window.location.origin}/update-password` },
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Password reset email sent to learner@example.com.',
  );
});

test('confirms user deletion through the protected backend endpoint', async () => {
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com' }]
        : table === 'enrollments'
          ? [{ user_id: 'user-1', course_id: 'course-1', has_access: true }]
          : [],
      error: null,
    }),
  }));
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ deleted: true }),
  });

  render(<Admin onBack={jest.fn()} accessToken="admin-session-token" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(confirm).toHaveBeenCalledWith(
    'Delete "learner@example.com"? This permanently removes the Auth account and profile.',
  );
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:5000/api/admin/users/user-1',
    expect.objectContaining({
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-session-token' },
    }),
  );
  expect(await screen.findByText('No user profiles found.')).toBeInTheDocument();
});

test('creates a course and displays it in the course list', async () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  const insertedCourse = {
    id: 'course-1',
    title: 'Algebra Basics',
    description: 'Learn foundational algebra.',
    short_description: 'Algebra fundamentals',
    long_description: 'A complete algebra course.',
    cover_image_url: 'https://example.supabase.co/storage/v1/object/public/course-covers/cover.png',
    price: 19.99,
    syllabus_text: 'Numbers, variables, equations',
  };
  const single = jest.fn().mockResolvedValue({ data: insertedCourse, error: null });
  const selectAfterInsert = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select: selectAfterInsert });
  const selectCourses = jest.fn().mockResolvedValue({
    data: [{ id: 'course-old', title: 'Old Course', price: 10 }],
    error: null,
  });
  mockSupabaseTables((table) => (
    table === 'courses'
      ? { select: selectCourses, insert }
      : { select: jest.fn().mockResolvedValue({ data: [], error: null }) }
  ));

  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Course Manager' }));

  expect(await screen.findByText('Old Course')).toBeInTheDocument();
  expect(screen.getByText('Draft auto-saved locally')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Course Title'), {
    target: { value: 'Algebra Basics' },
  });
  fireEvent.change(screen.getByLabelText('Short Description'), {
    target: { value: 'Algebra fundamentals' },
  });
  fireEvent.change(screen.getByLabelText('Long Description'), {
    target: { value: 'A complete algebra course.' },
  });
  fireEvent.change(screen.getByLabelText('Course Price'), {
    target: { value: '19.99' },
  });
  fireEvent.change(screen.getByLabelText('Course Content (.txt)'), {
    target: {
      files: [new File(['Numbers, variables, equations'], 'algebra.txt', { type: 'text/plain' })],
    },
  });
  expect(await screen.findByText('Loaded: algebra.txt')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Upload Cover Image'), {
    target: {
      files: [new File(['image'], 'cover.png', { type: 'image/png' })],
    },
  });
  expect(await screen.findByAltText('Course cover preview')).toHaveAttribute(
    'src',
    insertedCourse.cover_image_url,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save Course' }));

  expect(await screen.findByText('Algebra Basics')).toBeInTheDocument();
  expect(screen.getByText('₹19.99')).toBeInTheDocument();
  expect(insert).toHaveBeenCalledWith({
    title: 'Algebra Basics',
    short_description: 'Algebra fundamentals',
    long_description: 'A complete algebra course.',
    price: 19.99,
    syllabus_text: 'Numbers, variables, equations',
  });
  expect(consoleLog).toHaveBeenCalledWith(
    'Inserting Course with Syllabus:',
    'Numbers, variables, equations',
  );
  expect(localStorage.getItem('draft_title')).toBeNull();
  expect(localStorage.getItem('draft_description')).toBeNull();
  expect(localStorage.getItem('draft_short_description')).toBeNull();
  expect(localStorage.getItem('draft_long_description')).toBeNull();
  expect(localStorage.getItem('draft_price')).toBeNull();
  expect(localStorage.getItem('draft_syllabus_text')).toBeNull();
  expect(supabase.storage.from).toHaveBeenCalledWith('course-covers');
});

test('preserves course form values when switching tabs', async () => {
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com', xp: 45 }]
        : table === 'courses'
          ? [{ id: 'course-old', title: 'Old Course', price: 10 }]
          : [],
      error: null,
    }),
  }));

  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Course Manager' }));
  await screen.findByText('Old Course');

  fireEvent.change(screen.getByLabelText('Course Title'), {
    target: { value: 'Saved Title' },
  });
  fireEvent.change(screen.getByLabelText('Short Description'), {
    target: { value: 'Saved short description' },
  });
  fireEvent.change(screen.getByLabelText('Long Description'), {
    target: { value: 'Saved long description' },
  });
  fireEvent.change(screen.getByLabelText('Course Price'), {
    target: { value: '27.50' },
  });
  fireEvent.change(screen.getByLabelText('Course Content (.txt)'), {
    target: {
      files: [new File(['Saved syllabus'], 'saved.txt', { type: 'text/plain' })],
    },
  });
  expect(await screen.findByText('Loaded: saved.txt')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'User Manager' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Course Manager' }));

  expect(screen.getByLabelText('Course Title')).toHaveValue('Saved Title');
  expect(screen.getByLabelText('Short Description')).toHaveValue('Saved short description');
  expect(screen.getByLabelText('Long Description')).toHaveValue('Saved long description');
  expect(screen.getByLabelText('Course Price')).toHaveValue(27.5);
  expect(screen.getByText('Loaded: saved.txt')).toBeInTheDocument();
});

test('restores course form values from localStorage after remounting', async () => {
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'profiles'
        ? [{ id: 'user-1', username: 'learner@example.com', xp: 45 }]
        : table === 'courses'
          ? [{ id: 'course-old', title: 'Old Course', price: 10 }]
          : [],
      error: null,
    }),
  }));

  const { unmount } = render(<Admin onBack={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Course Manager' }));
  await screen.findByText('Old Course');

  fireEvent.change(screen.getByLabelText('Course Title'), {
    target: { value: 'Draft title' },
  });
  fireEvent.change(screen.getByLabelText('Short Description'), {
    target: { value: 'Draft short description' },
  });
  fireEvent.change(screen.getByLabelText('Long Description'), {
    target: { value: 'Draft long description' },
  });
  fireEvent.change(screen.getByLabelText('Course Price'), {
    target: { value: '15.75' },
  });
  fireEvent.change(screen.getByLabelText('Course Content (.txt)'), {
    target: {
      files: [new File(['Draft syllabus'], 'draft.txt', { type: 'text/plain' })],
    },
  });
  await screen.findByText('Loaded: draft.txt');

  expect(localStorage.getItem('draft_title')).toBe('Draft title');
  expect(localStorage.getItem('draft_short_description')).toBe('Draft short description');
  expect(localStorage.getItem('draft_long_description')).toBe('Draft long description');
  expect(localStorage.getItem('draft_description')).toBe('Draft syllabus');
  expect(localStorage.getItem('draft_price')).toBe('15.75');
  expect(localStorage.getItem('draft_syllabus_text')).toBe('Draft syllabus');

  unmount();
  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Course Manager' }));
  await screen.findByText('Old Course');
  expect(screen.getByLabelText('Course Title')).toHaveValue('Draft title');
  expect(screen.getByLabelText('Short Description')).toHaveValue('Draft short description');
  expect(screen.getByLabelText('Long Description')).toHaveValue('Draft long description');
  expect(screen.getByLabelText('Course Price')).toHaveValue(15.75);
  expect(screen.getByText('Saved course content draft')).toBeInTheDocument();
});

test('confirms and deletes a course from the course list', async () => {
  const deleteById = jest.fn().mockResolvedValue({ error: null });
  const removeCourse = jest.fn().mockReturnValue({ eq: deleteById });
  const existingCourse = { id: 'course-old', title: 'Old Course', price: 10 };
  mockSupabaseTables((table) => ({
    select: jest.fn().mockResolvedValue({
      data: table === 'courses' ? [existingCourse] : [],
      error: null,
    }),
    delete: removeCourse,
  }));
  jest.spyOn(window, 'confirm').mockReturnValue(true);

  render(<Admin onBack={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Course Manager' }));
  expect(await screen.findByText('Old Course')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

  expect(window.confirm).toHaveBeenCalledWith(
    'Delete "Old Course"? This cannot be undone.',
  );
  expect(removeCourse).toHaveBeenCalled();
  expect(deleteById).toHaveBeenCalledWith('id', 'course-old');
  expect(await screen.findByText('No courses found.')).toBeInTheDocument();
});
