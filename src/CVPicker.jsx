import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { DownloadCV } from './ActionFeedback.jsx';
import { cvVariants } from './cvVariants.js';

export default function CVPicker({ variants = cvVariants }) {
  const allPending = variants.every((variant) => !variant.file);
  return (
    <>
      <h1 id="cv-picker-title">Choose a CV</h1>
      <p className="cv-picker-caption">
        {allPending
          ? 'Five versions for different roles. PDFs coming soon.'
          : 'Explore my experience or choose a specialist CV. Download as PDF.'}
      </p>
      <ul className="cv-options" aria-label="CV versions">
        {variants.map((variant) => (
          <li key={variant.id}>
            {variant.file ? (
              <DownloadCV
                className="cv-option"
                href={variant.file}
                filename={variant.filename}
                aria-label={`Download ${variant.title}`}
                title={variant.title}
              >
                <span className="cv-option-title">{variant.title}</span>
                <span className="cv-option-download" aria-hidden="true">
                  <DownloadSimpleIcon />
                </span>
              </DownloadCV>
            ) : (
              <button
                className="cv-option"
                disabled
                aria-label={`Download ${variant.title}, coming soon`}
              >
                <span className="cv-option-title">{variant.title}</span>
                <span className="cv-option-download" aria-hidden="true">
                  <DownloadSimpleIcon />
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
