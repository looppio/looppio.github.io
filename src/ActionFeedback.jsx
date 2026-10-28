import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CopySimpleIcon } from '@phosphor-icons/react/dist/csr/CopySimple';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import './action-feedback.css';

function FeedbackPopover({
  id,
  anchor,
  onClose,
  children,
  noticeKey,
  duration = 8000,
  centered = false,
}) {
  const panel = useRef(null),
    timer = useRef(null);
  const [position, setPosition] = useState(null);
  const stop = useCallback(() => clearTimeout(timer.current), []);
  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onClose(), duration);
  }, [duration, onClose]);
  const close = useCallback(() => {
    const restore = panel.current?.contains(document.activeElement);
    onClose();
    if (restore) anchor.current?.focus({ preventScroll: true });
  }, [anchor, onClose]);
  useLayoutEffect(() => {
    const place = () => {
      const trigger = anchor.current,
        node = panel.current;
      if (!trigger || !node) return;
      const rect = trigger.getBoundingClientRect(),
        box = node.getBoundingClientRect(),
        width = document.documentElement.clientWidth,
        height = document.documentElement.clientHeight;
      const lens = trigger.closest('.center-panel')?.getBoundingClientRect();
      const center = lens ? lens.left + lens.width / 2 : width / 2;
      const left = Math.max(
        12,
        Math.min(
          centered ? center - box.width / 2 : rect.right - box.width,
          width - box.width - 12,
        ),
      );
      const below = rect.bottom + 12,
        above = rect.top - box.height - 12;
      setPosition({
        left,
        top: Math.max(
          12,
          Math.min(below + box.height <= height - 12 ? below : above, height - box.height - 12),
        ),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, noticeKey, centered]);
  useEffect(() => {
    const outside = (e) => {
      if (!panel.current?.contains(e.target) && !anchor.current?.contains(e.target)) onClose();
    };
    const escape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    };
    const other = (e) => {
      if (e.detail !== id) onClose();
    };
    window.dispatchEvent(new CustomEvent('portfolio-feedback-open', { detail: id }));
    window.addEventListener('portfolio-feedback-open', other);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    start();
    return () => {
      stop();
      window.removeEventListener('portfolio-feedback-open', other);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [id, noticeKey, onClose, close, start, stop]);
  return createPortal(
    <section
      ref={panel}
      id={id}
      className="action-feedback"
      role="dialog"
      aria-label="Action confirmation"
      data-portfolio-popover
      data-gl-shield
      style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
      onPointerEnter={stop}
      onPointerLeave={() => {
        if (!panel.current?.contains(document.activeElement)) start();
      }}
      onFocusCapture={stop}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) start();
      }}
    >
      <button className="feedback-close" aria-label="Close notification" onClick={close}>
        <XIcon aria-hidden="true" />
      </button>
      {children}
    </section>,
    document.body,
  );
}

async function copyEmail(address) {
  try {
    await navigator.clipboard.writeText(address);
    return true;
  } catch {
    // Older browsers and restricted clipboard permissions still get a real
    // copy attempt. Never show success if the browser refused both methods.
    const prior = document.activeElement,
      field = document.createElement('textarea');
    field.value = address;
    field.readOnly = true;
    field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
    } finally {
      field.remove();
      prior?.focus?.({ preventScroll: true });
    }
    return copied;
  }
}

export function EmailCopy({ address, telegram, linkedin }) {
  const anchor = useRef(null),
    mounted = useRef(true),
    request = useRef(0),
    id = useId();
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);
  const close = useCallback(() => setNotice(null), []);
  const copy = async () => {
    const current = ++request.current;
    const copied = await copyEmail(address);
    if (mounted.current && current === request.current) setNotice({ copied, key: Date.now() });
  };
  return (
    <>
      <button
        ref={anchor}
        className="email-copy"
        onClick={copy}
        aria-label="Copy email address"
        aria-haspopup="dialog"
        aria-expanded={!!notice}
        aria-controls={notice ? id : undefined}
      >
        Email
        <CopySimpleIcon aria-hidden="true" />
      </button>
      {notice && (
        <FeedbackPopover id={id} anchor={anchor} onClose={close} noticeKey={notice.key} centered>
          <div className="feedback-title" role="status">
            {notice.copied && <CheckCircleIcon weight="fill" aria-hidden="true" />}
            {notice.copied ? 'Email copied' : 'Copy email manually'}
          </div>
          <p className="feedback-email">{address}</p>
          <p className="feedback-note">For a first hello, Telegram works best.</p>
          <div className="feedback-actions">
            <a className="feedback-primary" href={telegram} target="_blank" rel="noreferrer">
              Message on Telegram
              <ArrowUpRightIcon aria-hidden="true" />
            </a>
            <a href={linkedin} target="_blank" rel="noreferrer">
              LinkedIn
              <ArrowUpRightIcon aria-hidden="true" />
            </a>
          </div>
        </FeedbackPopover>
      )}
    </>
  );
}

export function DownloadCV({ children, href, filename = 'Oleksii_Tyshchenko_CV.pdf', ...props }) {
  const anchor = useRef(null),
    id = useId();
  const [notice, setNotice] = useState(null);
  const close = useCallback(() => setNotice(null), []);
  return (
    <>
      <a
        {...props}
        ref={anchor}
        href={href}
        download={filename || ''}
        aria-haspopup="dialog"
        aria-expanded={!!notice}
        aria-controls={notice ? id : undefined}
        onClick={(e) => {
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) setNotice(Date.now());
        }}
      >
        {children}
      </a>
      {notice && (
        <FeedbackPopover id={id} anchor={anchor} onClose={close} noticeKey={notice} duration={6000}>
          <div className="feedback-title" role="status">
            Your download will start shortly.
          </div>
          <a className="feedback-direct" href={href} download={filename || ''}>
            Download directly
            <ArrowUpRightIcon aria-hidden="true" />
          </a>
        </FeedbackPopover>
      )}
    </>
  );
}
