import { useState } from 'react';

import { useAuth } from '../../../auth/AuthProvider';
import ConfirmModal from '../../../components/layout/modals/ConfirmModal';
import { supabase } from '../../../lib/supabase';
import { faceShapeLabel, FACE_SHAPE_DEFINITIONS, FACE_SHAPES } from '../face/shapes';
import type { FaceProfileState } from '../face/useFaceProfile';

interface AccountProps {
  face: FaceProfileState;
  onAnalyzeFace: () => void;
}

/**
 * Account. Reads the Supabase session and profile.
 *
 * Centred and width-capped rather than filling the pane: this is a settings
 * page, not a dashboard, and stretching four short cards across 1000px left
 * them as a row of thin slivers.
 */
const Account: React.FC<AccountProps> = ({ face, onAnalyzeFace }) => {
  const { session, profile, signOut } = useAuth();
  const [isConfirmingOut, setIsConfirmingOut] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [shapeError, setShapeError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setDeleteError(null);

    const { error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: 'DELETE' },
    });

    if (error) {
      // A missing edge function is a deployment gap, not a transient failure,
      // and "try again in a moment" sends the customer in circles against it.
      // supabase-js puts the raw Response on error.context for non-2xx.
      const context = (error as { context?: unknown }).context;
      const response = context instanceof Response ? context : null;
      const status = response?.status ?? null;

      if (status === 404) {
        setDeleteError(
          'Account deletion is not available right now. Nothing has been deleted, and you can remove your account by emailing support.',
        );
        return;
      }

      if (status === 401) {
        setDeleteError('Your session expired. Sign out, sign back in, then try again.');
        return;
      }

      // 5xx now means the function stopped partway rather than finishing quietly,
      // so its message is worth showing: it names which rows survived. Falling
      // back keeps the customer-facing text for a response with no body.
      const detail = response
        ? await response
            .json()
            .then((body: { error?: unknown }) =>
              typeof body?.error === 'string' ? body.error : null,
            )
            .catch(() => null)
        : null;

      setDeleteError(
        detail ??
          'Could not delete your account. Try again in a moment.',
      );
      return;
    }

    // Sign out is what moves them home and clears the local session. The rows
    // are already gone by the time this runs.
    await signOut();
  };

  const created = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <>
      <div className="trim-account-page">
        <header className="trim-section__head">
          <h1 className="trim-section__title">Account</h1>
          <p className="trim-section__lede">
            Your Trim profile is created the first time you sign in and lives
            under your Google account. Change your name or email in Google and
            it updates here on your next sign in.
          </p>
        </header>

        {/* Inside the centred page, not beside it. As a sibling of this div it
            rendered in the dashboard's left grid column, which put the message
            in a narrow strip on the far left of the window. */}
        {deleteError ? (
          <p className="trim-account__error" role="alert">
            {deleteError}
          </p>
        ) : null}

        <div className="trim-account">
          <div className="trim-card">
            <h2 className="trim-card__title">Profile</h2>
            <dl className="trim-facts">
              <div>
                <dt>Username</dt>
                <dd>{profile?.username ?? 'Not set'}</dd>
              </div>
              <div>
                <dt>Name</dt>
                <dd>{profile?.displayName ?? 'Not provided'}</dd>
              </div>
              {/* Full width: the longest value here, and it splits mid-word. */}
              <div className="trim-facts__wide">
                <dt>Email</dt>
                <dd>{session?.user.email ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Signed in with</dt>
                <dd>Google</dd>
              </div>
              {created ? (
                <div>
                  <dt>Member since</dt>
                  <dd>{created}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="trim-card">
            <h2 className="trim-card__title">Face shape</h2>

            {face.isLoading ? (
              <p className="trim-card__text">Loading your reading…</p>
            ) : (
              <>
                <p className="trim-shape__current">
                  {face.shape ? (
                    <>
                      <strong>{faceShapeLabel(face.shape)}</strong>
                      <span className="trim-shape__source">
                        {face.profile?.source === 'scanned'
                          ? `Scanned${face.profile.confidence ? ` · ${face.profile.confidence}% confidence` : ''}`
                          : 'Set by you'}
                      </span>
                    </>
                  ) : (
                    <span className="trim-shape__source">Not set yet</span>
                  )}
                </p>

                {face.profile?.measurements ? (
                  <p className="trim-card__text">
                    Forehead {Math.round(face.profile.measurements.foreheadRatio * 100)}%,
                    jaw {Math.round(face.profile.measurements.jawRatio * 100)}%,
                    length {Math.round(face.profile.measurements.lengthRatio * 100)}% of
                    your cheekbone width.
                  </p>
                ) : null}

                {shapeError ? (
                  <p className="trim-account__error" role="alert">
                    {shapeError}
                  </p>
                ) : null}

                <fieldset className="trim-shape__picker">
                  <legend className="trim-shape__legend">
                    Already know your shape?
                  </legend>

                  <div className="trim-shape__options">
                    {FACE_SHAPES.map((option) => (
                      <label
                        className={`trim-shape__option${
                          face.shape === option ? ' trim-shape__option--current' : ''
                        }`}
                        key={option}
                      >
                        <input
                          type="radio"
                          name="face-shape"
                          value={option}
                          checked={face.shape === option}
                          disabled={face.isSaving}
                          onChange={async () => {
                            setShapeError(null);
                            const saved = await face.setShape(option);
                            if (!saved) setShapeError('Could not save that. Try again.');
                          }}
                        />
                        <span>{faceShapeLabel(option)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <p className="trim-shape__hint">
                  {face.shape
                    ? FACE_SHAPE_DEFINITIONS[face.shape].summary
                    : 'Pick one above, or let the camera work it out from four measurements.'}
                </p>

                <button
                  className="trim-account__analyze"
                  type="button"
                  onClick={onAnalyzeFace}
                >
                  {face.profile?.source === 'scanned'
                    ? 'Analyze again'
                    : 'Not sure? Analyze my face'}
                </button>

                <p className="trim-shape__privacy">
                  The analyzer uses your camera only while it is open. The image is
                  processed on your device and never uploaded — only the four
                  measurements are saved.
                </p>
              </>
            )}
          </div>

          <div className="trim-card">
            <h2 className="trim-card__title">Data</h2>
            <p className="trim-card__text">
              Trim stores your profile, the styles you save, your face shape
              reading and your booking history. Nothing is shared with barbers
              until you book, and the reference image only goes with the
              appointment you confirm.
            </p>
          </div>

          <div className="trim-card">
            <h2 className="trim-card__title">Session</h2>
            <dl className="trim-facts">
              <div>
                <dt>Provider</dt>
                <dd>Google</dd>
              </div>
              <div>
                <dt>Refreshes</dt>
                <dd>Automatically</dd>
              </div>
              <div>
                <dt>On this device</dt>
                <dd>Signed in</dd>
              </div>
            </dl>
          </div>

          <div className="trim-card trim-card--danger">
            <h2 className="trim-card__title">Delete account</h2>
            <p className="trim-card__text">
              Removes your profile, saved styles, face shape reading, bookings and
              every Trimo chat. This cannot be undone.
            </p>
            <button
              className="trim-account__delete"
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete my account
            </button>
          </div>
        </div>

        <button
          className="trim-account__signout"
          type="button"
          onClick={() => setIsConfirmingOut(true)}
        >
          Log out of Trim
        </button>
      </div>

      <ConfirmModal
        isOpen={isConfirmingOut}
        title="Log out of Trim?"
        message={`You are signed in as ${profile?.username ?? profile?.displayName ?? 'your account'}. You will need to sign in with Google again to get back in.`}
        confirmLabel="Log out"
        onConfirm={signOut}
        onDismiss={() => setIsConfirmingOut(false)}
      />

      <ConfirmModal
        isOpen={isConfirmingDelete}
        title="Delete your account?"
        message="Your profile, saved styles, face shape reading, bookings and every Trimo chat are erased. There is no way back from this."
        confirmLabel="Delete everything"
        pendingLabel="Deleting…"
        verifyText="DELETE"
        onConfirm={deleteAccount}
        onDismiss={() => setIsConfirmingDelete(false)}
      />
    </>
  );
};

export default Account;
