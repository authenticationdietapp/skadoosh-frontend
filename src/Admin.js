import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const COURSE_DRAFT_KEYS = {
  title: 'draft_title',
  description: 'draft_description',
  shortDescription: 'draft_short_description',
  longDescription: 'draft_long_description',
  price: 'draft_price',
  syllabusText: 'draft_syllabus_text',
};

function WebsiteLaunchControl({ onLaunchStatusChange }) {
  const [isLaunched, setIsLaunched] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadLaunchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('id, is_launched')
          .eq('id', 1)
          .maybeSingle();
        if (error) {
          throw error;
        }
        if (!data) {
          throw new Error('The site_settings row with id 1 was not found.');
        }
        if (typeof data.is_launched !== 'boolean') {
          throw new Error('The site launch status is not a boolean value.');
        }

        if (isMounted) {
          setIsLaunched(data.is_launched);
        }
      } catch (error) {
        console.error('Failed to load website launch status:', error);
        if (isMounted) {
          setErrorMessage(`Could not load website launch status: ${error.message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadLaunchStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleLaunchStatus = async () => {
    if (isUpdating || typeof isLaunched !== 'boolean') {
      return;
    }

    const nextLaunchStatus = !isLaunched;
    setErrorMessage('');
    setIsUpdating(true);

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .update({ is_launched: nextLaunchStatus })
        .eq('id', 1)
        .select('is_launched')
        .single();
      if (error) {
        throw error;
      }
      if (data?.is_launched !== nextLaunchStatus) {
        throw new Error('Supabase did not confirm the requested website status.');
      }

      setIsLaunched(nextLaunchStatus);
      onLaunchStatusChange?.(nextLaunchStatus);
    } catch (error) {
      console.error('Failed to update website launch status:', error);
      setErrorMessage(`Could not update website launch status: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="website-launch-control" aria-label="Website launch status control">
      {isLoading ? (
        <p className="admin-status" role="status">Loading website launch status…</p>
      ) : (
        <>
          <p>
            Website Launch Status: <strong>{isLaunched ? 'LIVE' : 'OFFLINE'}</strong>
          </p>
          <button
            className="admin-toggle-button"
            type="button"
            onClick={toggleLaunchStatus}
            disabled={isUpdating || typeof isLaunched !== 'boolean'}
          >
            {isUpdating ? 'Updating…' : `Set ${isLaunched ? 'OFFLINE' : 'LIVE'}`}
          </button>
        </>
      )}
      {errorMessage && <p className="admin-error" role="alert">{errorMessage}</p>}
    </section>
  );
}

function CourseManager({
  courseTitle,
  setCourseTitle,
  shortDescription,
  setShortDescription,
  longDescription,
  setLongDescription,
  coursePrice,
  setCoursePrice,
  syllabusText,
  setSyllabusText,
  courseFile,
  setCourseFile,
  setCourseDescription,
  setCourseError,
  coverImageUrl,
  uploadCoverImage,
  isUploadingCoverImage,
  createCourse,
  deleteCourse,
  isCreatingCourse,
  deletingCourseId,
  courseError,
  courseMessage,
  courses,
  isLoadingCourses,
}) {
  return (
    <div id="course-manager-panel" role="tabpanel" aria-labelledby="course-manager-tab">
      <form className="course-form" onSubmit={createCourse}>
        <label htmlFor="course-title">Course Title</label>
        <input
          id="course-title"
          type="text"
          value={courseTitle}
          onChange={(event) => setCourseTitle(event.target.value)}
          required
        />
        <label htmlFor="course-short-description">Short Description</label>
        <input
          id="course-short-description"
          type="text"
          value={shortDescription}
          onChange={(event) => setShortDescription(event.target.value)}
          required
        />
        <label htmlFor="course-long-description">Long Description</label>
        <textarea
          id="course-long-description"
          rows="4"
          value={longDescription}
          onChange={(event) => setLongDescription(event.target.value)}
          required
        />
        <label htmlFor="course-price">Course Price</label>
        <input
          id="course-price"
          type="number"
          min="0"
          step="0.01"
          value={coursePrice}
          onChange={(event) => setCoursePrice(event.target.value)}
          required
        />
        <label htmlFor="course-file">Course Content (.txt)</label>
        <input
          id="course-file"
          type="file"
          accept=".txt,text/plain"
          required={!syllabusText.trim()}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setCourseError('');

            if (!file) {
              setCourseFile(null);
              setCourseDescription('');
              setSyllabusText('');
              return;
            }

            if (!file.name.toLowerCase().endsWith('.txt')) {
              setCourseFile(null);
              setCourseDescription('');
              setSyllabusText('');
              setCourseError('Please upload a .txt course content file.');
              return;
            }

            setCourseFile(null);
            setCourseDescription('');
            setSyllabusText('');
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== 'string' || !reader.result.trim()) {
                setCourseError('The selected .txt file is empty or could not be read.');
                return;
              }

              setCourseFile(file);
              setSyllabusText(reader.result);
              setCourseDescription(reader.result.trim().slice(0, 200));
            };
            reader.onerror = () => {
              setCourseError(
                `Could not read the selected file${reader.error?.message ? `: ${reader.error.message}` : '.'}`,
              );
            };
            reader.readAsText(file);
          }}
        />
        {courseFile ? (
          <p className="course-file-name">Loaded: {courseFile.name}</p>
        ) : syllabusText ? (
          <p className="course-file-name">Saved course content draft</p>
        ) : null}
        <label htmlFor="course-cover-image">Upload Cover Image</label>
        <input
          id="course-cover-image"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              uploadCoverImage(file);
            } else {
              uploadCoverImage(null);
            }
          }}
        />
        {isUploadingCoverImage && (
          <p className="admin-status" role="status">Uploading cover image…</p>
        )}
        {coverImageUrl && (
          <img className="course-cover-preview" src={coverImageUrl} alt="Course cover preview" />
        )}
        <div className="course-create-actions">
          <button
            className="course-create-button"
            type="submit"
            disabled={isCreatingCourse || isUploadingCoverImage}
          >
            {isCreatingCourse ? 'Creating…' : 'Save Course'}
          </button>
          <span className="course-draft-indicator">Draft auto-saved locally</span>
        </div>
      </form>

      {courseError && <p className="admin-error" role="alert">{courseError}</p>}
      {courseMessage && <p className="admin-success" role="status">{courseMessage}</p>}
      <h2 className="course-list-title">Existing Courses</h2>
      {isLoadingCourses ? (
        <p className="admin-status" role="status">Loading courses…</p>
      ) : courses.length === 0 ? (
        <p className="course-empty">No courses found.</p>
      ) : (
        <ul className="course-list">
          {courses.map((course, index) => (
            <li className="course-list-item" key={course.id || `${course.title}-${index}`}>
              <span>{course.title}</span>
              <strong>₹{Number(course.price || 0).toFixed(2)}</strong>
              <button
                className="course-delete-button"
                type="button"
                onClick={() => deleteCourse(course)}
                disabled={deletingCourseId === course.id}
              >
                {deletingCourseId === course.id ? 'Deleting…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Admin({ onBack, accessToken, onLaunchStatusChange }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [courses, setCourses] = useState([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(true);
  const [enrollmentError, setEnrollmentError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [updatingEnrollmentKeys, setUpdatingEnrollmentKeys] = useState([]);
  const [userActionMessage, setUserActionMessage] = useState('');
  const [userActionError, setUserActionError] = useState('');
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [courseMessage, setCourseMessage] = useState('');
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [courseFile, setCourseFile] = useState(null);
  const [shortDescription, setShortDescription] = useState(
    () => localStorage.getItem(COURSE_DRAFT_KEYS.shortDescription) || '',
  );
  const [longDescription, setLongDescription] = useState(
    () => localStorage.getItem(COURSE_DRAFT_KEYS.longDescription) || '',
  );
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
  const coverUploadRequestRef = useRef(0);
  const [courseTitle, setCourseTitle] = useState(
    () => localStorage.getItem(COURSE_DRAFT_KEYS.title) || '',
  );
  const [courseDescription, setCourseDescription] = useState(
    () => localStorage.getItem(COURSE_DRAFT_KEYS.description) || '',
  );
  const [coursePrice, setCoursePrice] = useState(
    () => localStorage.getItem(COURSE_DRAFT_KEYS.price) || '',
  );
  const [syllabusText, setSyllabusText] = useState(
    () => localStorage.getItem(COURSE_DRAFT_KEYS.syllabusText) || '',
  );

  useEffect(() => {
    const draftFields = [
      [COURSE_DRAFT_KEYS.title, courseTitle],
      [COURSE_DRAFT_KEYS.description, courseDescription],
      [COURSE_DRAFT_KEYS.shortDescription, shortDescription],
      [COURSE_DRAFT_KEYS.longDescription, longDescription],
      [COURSE_DRAFT_KEYS.price, coursePrice],
      [COURSE_DRAFT_KEYS.syllabusText, syllabusText],
    ];

    draftFields.forEach(([key, value]) => {
      if (value) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    });
  }, [courseTitle, courseDescription, shortDescription, longDescription, coursePrice, syllabusText]);

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) {
          throw error;
        }

        if (isMounted) {
          setUsers(data || []);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load profiles for the admin dashboard:', error);
        if (isMounted) {
          setErrorMessage(`Could not load users: ${error.message}`);
          setIsLoading(false);
        }
      }
    };

    loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCourses = async () => {
      try {
        const { data, error } = await supabase.from('courses').select('*');
        if (error) {
          throw error;
        }

        if (isMounted) {
          setCourses(data || []);
        }
      } catch (error) {
        console.error('Failed to load courses for the admin dashboard:', error);
        if (isMounted) {
          setCourseError(`Could not load courses: ${error.message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCourses(false);
        }
      }
    };

    loadCourses();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadEnrollments = async () => {
      try {
        const { data, error } = await supabase.from('enrollments').select('*');
        if (error) {
          throw error;
        }

        if (isMounted) {
          setEnrollments(data || []);
        }
      } catch (error) {
        console.error('Failed to load enrollments for the admin dashboard:', error);
        if (isMounted) {
          setEnrollmentError(`Could not load enrollments: ${error.message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoadingEnrollments(false);
        }
      }
    };

    loadEnrollments();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleCourseAccess = async (user, course, shouldHaveAccess) => {
    const enrollmentKey = `${user.id}:${course.id}`;
    if (updatingEnrollmentKeys.includes(enrollmentKey)) {
      return;
    }

    const enrollment = enrollments.find(
      (item) => item.user_id === user.id && item.course_id === course.id,
    );
    setEnrollmentError('');
    setUserActionMessage('');
    setUpdatingEnrollmentKeys((currentKeys) => [...currentKeys, enrollmentKey]);

    try {
      const result = shouldHaveAccess
        ? enrollment
          ? await supabase
          .from('enrollments')
          .update({ has_access: true })
          .eq('user_id', user.id)
          .eq('course_id', course.id)
          : await supabase.from('enrollments').insert({
            user_id: user.id,
            course_id: course.id,
            has_access: true,
          })
        : await supabase
          .from('enrollments')
          .delete()
          .eq('user_id', user.id)
          .eq('course_id', course.id);
      const { error } = result;
      if (error) {
        throw error;
      }

      setEnrollments((currentEnrollments) => {
        if (!shouldHaveAccess) {
          return currentEnrollments.filter((item) => (
            item.user_id !== user.id || item.course_id !== course.id
          ));
        }
        if (enrollment) {
          return currentEnrollments.map((item) => (
            item.user_id === user.id && item.course_id === course.id
              ? { ...item, has_access: true }
              : item
          ));
        }
        return [
          ...currentEnrollments,
          { user_id: user.id, course_id: course.id, has_access: true },
        ];
      });
      setUserActionMessage(
        `${shouldHaveAccess ? 'Granted' : 'Revoked'} access to ${course.title} for ${user.username || 'the user'}.`,
      );
    } catch (error) {
      console.error('Failed to update course access:', error);
      setEnrollmentError(
        `Could not ${shouldHaveAccess ? 'grant' : 'revoke'} access to ${course.title}: ${error.message}`,
      );
    } finally {
      setUpdatingEnrollmentKeys((currentKeys) => (
        currentKeys.filter((key) => key !== enrollmentKey)
      ));
    }
  };

  const resetUserPassword = async (user) => {
    const email = user.email || user.username;
    if (!email || !email.includes('@')) {
      setUserActionError(`Could not reset the password: no email address is available for ${user.username || 'this user'}.`);
      setUserActionMessage('');
      return;
    }

    setUserActionError('');
    setUserActionMessage('');
    setResettingPasswordUserId(user.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) {
        throw error;
      }
      setUserActionMessage(`Password reset email sent to ${email}.`);
    } catch (error) {
      console.error('Failed to send a password reset email:', error);
      setUserActionError(`Could not send a password reset email to ${email}: ${error.message}`);
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete "${user.username || user.id}"? This permanently removes the Auth account and profile.`)) {
      return;
    }

    setUserActionError('');
    setUserActionMessage('');
    setDeletingUserId(user.id);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken || ''}`,
        },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}.`);
      }

      setUsers((currentUsers) => currentUsers.filter((item) => item.id !== user.id));
      setEnrollments((currentEnrollments) => currentEnrollments.filter((item) => item.user_id !== user.id));
      setSelectedUserId((currentId) => (currentId === user.id ? null : currentId));
      setUserActionMessage(`Deleted ${user.username || 'the user'}.`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      setUserActionError(`Could not delete ${user.username || 'the user'}: ${error.message}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  const activeEnrollments = enrollments.filter((enrollment) => enrollment.has_access === true);
  const totalRevenue = activeEnrollments.reduce((total, enrollment) => {
    const course = courses.find((item) => item.id === enrollment.course_id);
    return total + (Number(course?.price) || 0);
  }, 0);
  const totalPaidUsers = new Set(activeEnrollments.map((enrollment) => enrollment.user_id)).size;

  const uploadCoverImage = async (file) => {
    const requestId = coverUploadRequestRef.current + 1;
    coverUploadRequestRef.current = requestId;
    setCourseError('');
    setCoverImageUrl('');

    if (!file) {
      setIsUploadingCoverImage(false);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setIsUploadingCoverImage(false);
      setCourseError('Please choose a valid image file for the course cover.');
      return;
    }

    setIsUploadingCoverImage(true);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `${Date.now()}-${safeFileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('course-covers')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('course-covers')
        .getPublicUrl(data.path);
      if (!publicUrlData?.publicUrl) {
        throw new Error('Supabase did not return a public URL for the uploaded cover image.');
      }

      if (requestId === coverUploadRequestRef.current) {
        setCoverImageUrl(publicUrlData.publicUrl);
      }
    } catch (error) {
      if (requestId === coverUploadRequestRef.current) {
        console.error('Failed to upload course cover image:', error);
        setCourseError(`Could not upload course cover image: ${error.message}`);
      }
    } finally {
      if (requestId === coverUploadRequestRef.current) {
        setIsUploadingCoverImage(false);
      }
    }
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) {
      return;
    }

    setCourseError('');
    setCourseMessage('');
    setDeletingCourseId(course.id);

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', course.id);
      if (error) {
        throw error;
      }

      setCourses((currentCourses) => currentCourses.filter((item) => item.id !== course.id));
      setCourseMessage(`Deleted "${course.title}".`);
    } catch (error) {
      console.error('Failed to delete course:', error);
      setCourseError(`Could not delete ${course.title}: ${error.message}`);
    } finally {
      setDeletingCourseId(null);
    }
  };

  const createCourse = async (event) => {
    event.preventDefault();
    setCourseError('');
    setCourseMessage('');

    setIsCreatingCourse(true);

    try {
      let courseSyllabusText = syllabusText;
      if (courseFile) {
        courseSyllabusText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== 'string') {
              reject(new Error('The selected .txt file could not be read.'));
              return;
            }
            resolve(reader.result);
          };
          reader.onerror = () => {
            reject(new Error(
              `Could not read the selected file${reader.error?.message ? `: ${reader.error.message}` : '.'}`,
            ));
          };
          reader.readAsText(courseFile);
        });
      }

      if (!courseSyllabusText.trim()) {
        setCourseError('Upload a non-empty .txt file with the course content.');
        return;
      }

      const course = {
        title: courseTitle.trim(),
        short_description: shortDescription.trim(),
        long_description: longDescription.trim(),
        price: Number(coursePrice),
        syllabus_text: courseSyllabusText,
      };

      console.log('Inserting Course with Syllabus:', courseSyllabusText);
      const { data, error } = await supabase
        .from('courses')
        .insert(course)
        .select()
        .single();
      if (error) {
        throw error;
      }

      setCourses((currentCourses) => [data || course, ...currentCourses]);
      setCourseTitle('');
      setCourseDescription('');
      setShortDescription('');
      setLongDescription('');
      setCoursePrice('');
      setSyllabusText('');
      setCourseFile(null);
      setCoverImageUrl('');
      Object.values(COURSE_DRAFT_KEYS).forEach((key) => localStorage.removeItem(key));
      setCourseMessage('Course created successfully.');
    } catch (error) {
      console.error('Failed to create course:', error);
      setCourseError(`Could not create course: ${error.message}`);
    } finally {
      setIsCreatingCourse(false);
    }
  };

  return (
    <section className="admin-panel" aria-labelledby="admin-title">
      <header className="admin-header">
        <div>
          <p className="quest-label">LEARNING QUEST</p>
          <h1 id="admin-title">Admin Dashboard</h1>
          <p>Manage learner profiles and premium access.</p>
        </div>
        <button className="admin-back-button" type="button" onClick={onBack}>
          Back to Chat
        </button>
      </header>

      <WebsiteLaunchControl onLaunchStatusChange={onLaunchStatusChange} />

      <section className="admin-analytics" aria-label="Financial overview">
        <article className="admin-analytics-card">
          <span>Total Revenue</span>
          <strong>{new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
          }).format(totalRevenue)}</strong>
        </article>
        <article className="admin-analytics-card">
          <span>Total Paid Users</span>
          <strong>{totalPaidUsers}</strong>
        </article>
        <article className="admin-analytics-card">
          <span>Total Courses</span>
          <strong>{courses.length}</strong>
        </article>
      </section>
      <p className="admin-analytics-note">
        Revenue and paid-user totals are estimates from active enrollments and current course prices; no payment ledger is configured.
      </p>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        <button
          id="user-manager-tab"
          className={`admin-tab ${activeTab === 'users' ? 'admin-tab-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          aria-controls="user-manager-panel"
          onClick={() => setActiveTab('users')}
        >
          User Manager
        </button>
        <button
          id="course-manager-tab"
          className={`admin-tab ${activeTab === 'courses' ? 'admin-tab-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'courses'}
          aria-controls="course-manager-panel"
          onClick={() => setActiveTab('courses')}
        >
          Course Manager
        </button>
      </div>

      {activeTab === 'users' ? (
        <div id="user-manager-panel" role="tabpanel" aria-labelledby="user-manager-tab">
          {errorMessage && <p className="admin-error" role="alert">{errorMessage}</p>}
          {courseError && <p className="admin-error" role="alert">{courseError}</p>}
          {enrollmentError && <p className="admin-error" role="alert">{enrollmentError}</p>}
          {userActionError && <p className="admin-error" role="alert">{userActionError}</p>}
          {userActionMessage && <p className="admin-success" role="status">{userActionMessage}</p>}
          {isLoading ? (
            <p className="admin-status" role="status">Loading users…</p>
          ) : isLoadingEnrollments || isLoadingCourses ? (
            <p className="admin-status" role="status">Loading courses and enrollments…</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Username (email)</th>
                    <th scope="col">XP</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td className="admin-empty" colSpan="3">No user profiles found.</td>
                    </tr>
                  ) : users.map((user) => {
                    const isSelected = selectedUserId === user.id;
                    return (
                      <tr key={user.id}>
                        <td>
                          <span>
                            {user.username || '—'}
                          </span>
                          {isSelected && (
                            <div className="user-course-access" id={`courses-for-${user.id}`}>
                              <h3>Course access</h3>
                              {courses.length === 0 ? (
                                <p className="course-empty">No courses available.</p>
                              ) : (
                                <ul className="course-list">
                                  {courses.map((course) => {
                                    const enrollment = enrollments.find(
                                      (item) => item.user_id === user.id && item.course_id === course.id,
                                    );
                                    const hasAccess = enrollment?.has_access === true;
                                    const enrollmentKey = `${user.id}:${course.id}`;
                                    return (
                                      <li className="course-list-item" key={course.id}>
                                        <span>{course.title}</span>
                                        <label className="admin-access-checkbox">
                                          <input
                                            type="checkbox"
                                            checked={hasAccess}
                                            disabled={updatingEnrollmentKeys.includes(enrollmentKey)}
                                            aria-label={`${hasAccess ? 'Revoke' : 'Grant'} access to ${course.title} for ${user.username || 'user'}`}
                                            onChange={(event) => (
                                              toggleCourseAccess(user, course, event.target.checked)
                                            )}
                                          />
                                          <span>{hasAccess ? 'Access granted' : 'Grant access'}</span>
                                        </label>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}
                        </td>
                        <td>{user.xp ?? 0}</td>
                        <td>
                          <div className="admin-user-actions">
                            <button
                              className="admin-toggle-button"
                              type="button"
                              aria-expanded={isSelected}
                              aria-controls={`courses-for-${user.id}`}
                              onClick={() => setSelectedUserId(isSelected ? null : user.id)}
                            >
                              Manage Access
                            </button>
                            <button
                              className="admin-toggle-button"
                              type="button"
                              disabled={resettingPasswordUserId === user.id}
                              onClick={() => resetUserPassword(user)}
                            >
                              {resettingPasswordUserId === user.id ? 'Sending…' : 'Reset Password'}
                            </button>
                            <button
                              className="admin-delete-user-button"
                              type="button"
                              disabled={deletingUserId === user.id}
                              onClick={() => deleteUser(user)}
                            >
                              {deletingUserId === user.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <CourseManager
          courseTitle={courseTitle}
          setCourseTitle={setCourseTitle}
          shortDescription={shortDescription}
          setShortDescription={setShortDescription}
          longDescription={longDescription}
          setLongDescription={setLongDescription}
          coursePrice={coursePrice}
          setCoursePrice={setCoursePrice}
          syllabusText={syllabusText}
          setSyllabusText={setSyllabusText}
          courseFile={courseFile}
          setCourseFile={setCourseFile}
          setCourseDescription={setCourseDescription}
          setCourseError={setCourseError}
          coverImageUrl={coverImageUrl}
          uploadCoverImage={uploadCoverImage}
          isUploadingCoverImage={isUploadingCoverImage}
          createCourse={createCourse}
          deleteCourse={deleteCourse}
          isCreatingCourse={isCreatingCourse}
          deletingCourseId={deletingCourseId}
          courseError={courseError}
          courseMessage={courseMessage}
          courses={courses}
          isLoadingCourses={isLoadingCourses}
        />
      )}
    </section>
  );
}

export default Admin;
