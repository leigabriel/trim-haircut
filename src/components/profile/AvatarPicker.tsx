import { useId } from 'react';

import { AVATAR_GROUPS } from '../../auth/avatars';
import type { AvatarOption } from '../../auth/avatars';
import './AvatarPicker.css';

interface AvatarPickerProps {
  selectedUrl: string | null;
  onSelect: (option: AvatarOption) => void;
  disabled?: boolean;
  legend?: string;
}

/**
 * The six Trim avatars as a radio group.
 *
 * The inputs are visually hidden and the portrait is the visible control, so
 * keyboard focus is drawn on the image rather than on a 1px element. Grouping
 * the radio names with useId keeps the modal and the account card from sharing
 * one group if both are ever mounted at the same time.
 */
const AvatarPicker: React.FC<AvatarPickerProps> = ({
  selectedUrl,
  onSelect,
  disabled = false,
  legend = 'Choose an avatar',
}) => {
  const groupName = `trim-avatar-${useId().replace(/:/g, '')}`;

  return (
    <fieldset className="trim-avatar-picker" disabled={disabled}>
      <legend className="trim-avatar-picker__legend">{legend}</legend>

      <div className="trim-avatar-picker__groups">
        {AVATAR_GROUPS.map((group) => (
          <div className="trim-avatar-picker__group" key={group.label}>
            <p className="trim-avatar-picker__group-label">{group.label}</p>

            <div className="trim-avatar-picker__options">
              {group.options.map((option) => {
                const isSelected = selectedUrl === option.src;

                return (
                  <label
                    className={`trim-avatar-picker__option${
                      isSelected ? ' trim-avatar-picker__option--selected' : ''
                    }`}
                    key={option.id}
                  >
                    <input
                      className="trim-avatar-picker__input"
                      type="radio"
                      name={groupName}
                      value={option.id}
                      checked={isSelected}
                      onChange={() => onSelect(option)}
                      aria-label={option.label}
                    />

                    <img
                      className="trim-avatar-picker__image"
                      src={option.src}
                      alt=""
                      width={128}
                      height={128}
                      loading="lazy"
                    />

                    <span className="trim-avatar-picker__check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
                        <path
                          d="M5 13l4.5 4.5L19 7"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
};

export default AvatarPicker;
