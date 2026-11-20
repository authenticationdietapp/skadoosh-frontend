import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Avatar3D from './components/Avatar3D.jsx';

const formatPrice = (price) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(price) || 0);

function Dashboard({ userId, userEmail, preferredName, username, onStartLearning }) {
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [processingCourseId, setProcessingCourseId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadCoursesAndEnrollments = async () => {
      try {
        const [coursesResult, enrollmentsResult] = await Promise.all([
          supabase.from('courses').select('*'),
          supabase.from('enrollments').select('*').eq('user_id', userId),
        ]);

        if (coursesResult.error) {
          throw coursesResult.error;
        }

        if (isMounted) {
          setCourses(coursesResult.data || []);
          if (enrollmentsResult.error) {
            console.error('Failed to load dashboard enrollments:', enrollmentsResult.error);
            setEnrollments([]);
            setErrorMessage(`Could not load your course access: ${enrollmentsResult.error.message}`);
          } else {
            setEnrollments(enrollmentsResult.data || []);
          }
        }
      } catch (error) {
        console.error('Failed to load dashboard courses:', error);
        if (isMounted) {
          setErrorMessage(`Could not load courses: ${error.message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCoursesAndEnrollments();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const purchaseCourse = async (course) => {
    if (processingCourseId) {
      return;
    }

    setErrorMessage('');
    setPaymentMessage('');
    setProcessingCourseId(course.id);

    try {
      if (typeof window.Razorpay !== 'function') {
        throw new Error('Razorpay checkout did not load. Refresh the page and try again.');
      }

      const orderResponse = await fetch('http://localhost:5000/api/payment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: course.price, courseId: course.id }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Could not start the payment.');
      }

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: Math.round(Number(course.price) * 100),
        currency: 'INR',
        order_id: orderData.orderId,
        name: 'Bablu Learning',
        description: `Access to ${course.title}`,
        prefill: { name: userEmail, email: userEmail },
        handler: async (paymentResponse) => {
          try {
            const verificationResponse = await fetch('http://localhost:5000/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...paymentResponse,
                courseId: course.id,
              }),
            });
            const verificationData = await verificationResponse.json();
            if (!verificationResponse.ok || verificationData.verified !== true) {
              throw new Error(verificationData.error || 'Payment could not be verified.');
            }

            const { error } = await supabase.from('enrollments').insert({
              user_id: userId,
              course_id: course.id,
              has_access: true,
            });
            if (error) {
              throw error;
            }

            setEnrollments((currentEnrollments) => [
              ...currentEnrollments,
              { user_id: userId, course_id: course.id, has_access: true },
            ]);
            setPaymentMessage(`Payment successful. You now have access to ${course.title}.`);
          } catch (error) {
            console.error('Failed to verify payment or create enrollment:', error);
            setErrorMessage(
              `Payment was received, but course access could not be confirmed: ${error.message}`,
            );
          } finally {
            setProcessingCourseId(null);
          }
        },
        modal: {
          ondismiss: () => setProcessingCourseId(null),
        },
      });
      checkout.open();
    } catch (error) {
      console.error('Failed to start Razorpay checkout:', error);
      setErrorMessage(error.message || 'Could not start the payment.');
      setProcessingCourseId(null);
    }
  };

  return (
    <section className="learning-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-welcome">
        <header className="dashboard-heading">
          <p className="quest-label">YOUR LEARNING PATH</p>
          <h1 id="dashboard-title">Explore Courses</h1>
          <p>Hi {preferredName || username || 'friend'}, what are we learning today?</p>
        </header>
        <div className="dashboard-avatar-card" aria-label="Bablu, your learning guide">
          <Avatar3D className="dashboard-avatar" currentAction="idle" showShadow={false} />
        </div>
      </div>

      {errorMessage && <p className="admin-error" role="alert">{errorMessage}</p>}
      {paymentMessage && <p className="admin-success" role="status">{paymentMessage}</p>}
      {isLoading ? (
        <p className="admin-status" role="status">Loading courses…</p>
      ) : courses.length === 0 ? (
        <p className="dashboard-empty">No courses are available yet. Check back soon.</p>
      ) : (
        <div className="course-card-grid">
          {courses.map((course) => {
            const hasAccess = enrollments.some(
              (enrollment) => enrollment.course_id === course.id && enrollment.has_access === true,
            );
            return (
              <article className="course-card" key={course.id}>
                <div className="course-card-icon" aria-hidden="true">✦</div>
                <h2>{course.title}</h2>
                <p className="course-card-description">
                  {course.description || 'Explore the course syllabus and learn something new.'}
                </p>
                <div className="course-card-footer">
                  <strong className="course-card-price">{formatPrice(course.price)}</strong>
                  {hasAccess ? (
                    <button
                      className="course-card-button"
                      type="button"
                      onClick={() => onStartLearning({
                        id: course.id,
                        title: course.title,
                        syllabus_text: course.syllabus_text || '',
                      })}
                    >
                      Start Learning
                    </button>
                  ) : (
                    <button
                      className="course-card-button course-card-button-locked"
                      type="button"
                      disabled={processingCourseId !== null}
                      onClick={() => purchaseCourse(course)}
                    >
                      {processingCourseId === course.id
                        ? 'Processing Payment…'
                        : `Locked - Buy for ${formatPrice(course.price)}`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Dashboard;
