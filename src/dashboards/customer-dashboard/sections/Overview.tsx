import { useMemo } from 'react';

import { useAuth } from '../../../auth/AuthProvider';
import type { Conversation } from '../ai/trimo';
import { shapeAdvice } from '../face/advice';
import type { FaceProfileState } from '../face/useFaceProfile';
import { faceShapeLabel } from '../face/shapes';
import SectionHead from './SectionHead';

interface OverviewProps {
  face: FaceProfileState;
  conversations: Conversation[];
  onAnalyzeFace: () => void;
  onOpenAi: () => void;
}

const relative = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Unknown';

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hr ago`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / (60 * 24))} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const conversationLabel = (conversation: Conversation): string => {
  // The edge function names the row from the first question, so this is the
  // customer's own words rather than a generated label.
  const title = conversation.title?.trim();
  return title && title.length > 0 ? title : 'Untitled conversation';
};

/**
 * Landing section, built only from what Trim genuinely knows about this
 * customer.
 *
 * The previous version showed a six-month match-score chart and a hardcoded
 * next booking. Neither had data behind them — there is no bookings table and
 * no match history — so both rendered fiction. They are gone rather than
 * re-skinned.
 */
const Overview: React.FC<OverviewProps> = ({
  face,
  conversations,
  onAnalyzeFace,
  onOpenAi,
}) => {
  const { profile, session } = useAuth();

  const lastActive = useMemo(() => {
    if (conversations.length === 0) return null;
    return conversations
      .map((conversation) => conversation.updated_at)
      .sort()
      .at(-1) ?? null;
  }, [conversations]);

  const recent = useMemo(() => conversations.slice(0, 4), [conversations]);

  const memberSince = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
      })
    : null;

  const isLoading = face.isLoading;

  return (
    <>
      <SectionHead
        title="Overview"
        lede="What Trim knows about you right now, read from your profile, your face reading and your Trimo history."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Face shape</p>
          <p className="trim-metric__value">
            {isLoading ? '…' : face.shape ? faceShapeLabel(face.shape) : 'Not set'}
          </p>
          <p className="trim-metric__delta">
            {face.profile?.source === 'manual' ? 'Set by you' : 'Measured'}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Scan confidence</p>
          <p className="trim-metric__value">
            {isLoading ? '…' : face.profile?.confidence ? `${face.profile.confidence}%` : '—'}
          </p>
          <p className="trim-metric__delta">
            {face.profile?.measured_at ? relative(face.profile.measured_at) : 'No scan yet'}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Trimo chats</p>
          <p className="trim-metric__value">{conversations.length}</p>
          <p className="trim-metric__delta">
            {lastActive ? `Last ${relative(lastActive)}` : 'None yet'}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Member since</p>
          <p className="trim-metric__value">{memberSince ?? '—'}</p>
          <p className="trim-metric__delta">{profile?.username ?? 'Guest'}</p>
        </li>
      </ul>

      {/* The one thing worth acting on: no reading means no recommendations
          anywhere else in the app. */}
      {!isLoading && !face.shape ? (
        <div className="trim-card">
          <h2 className="trim-card__title">No face reading yet</h2>
          <p className="trim-card__text">
            Recommendation, your Trimo answers and the shape gallery all need to
            know your face shape. Set it by hand if you know it, or measure it in
            about twenty seconds.
          </p>
          <button className="trim-account__analyze" type="button" onClick={onAnalyzeFace}>
            Analyze my face
          </button>
        </div>
      ) : null}

      {face.shape ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Your reading</h2>
          <p className="trim-card__text">{shapeAdvice(face.shape).body}</p>

          {face.profile?.measurements ? (
            <ul className="trim-facts">
              <div>
                <dt>Forehead</dt>
                <dd>{Math.round(face.profile.measurements.foreheadRatio * 100)}%</dd>
              </div>
              <div>
                <dt>Cheekbones</dt>
                <dd>100%</dd>
              </div>
              <div>
                <dt>Jaw</dt>
                <dd>{Math.round(face.profile.measurements.jawRatio * 100)}%</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{Math.round(face.profile.measurements.lengthRatio * 100)}%</dd>
              </div>
            </ul>
          ) : (
            <p className="trim-card__text">
              You picked this shape rather than measuring it, so there are no
              measurements to show.
            </p>
          )}
        </div>
      ) : null}

      <div className="trim-card">
        <h2 className="trim-card__title">Recent conversations</h2>

        {recent.length === 0 ? (
          <p className="trim-card__text">
            You have not asked Trimo anything yet.
          </p>
        ) : (
          <ul className="trim-saved">
            {recent.map((conversation) => (
              <li className="trim-saved__row" key={conversation.id}>
                <span className="trim-saved__text">
                  <span className="trim-saved__name">{conversationLabel(conversation)}</span>
                  <span className="trim-saved__meta">{relative(conversation.updated_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <button className="trim-account__analyze" type="button" onClick={onOpenAi}>
          Ask Trimo
        </button>
      </div>
    </>
  );
};

export default Overview;