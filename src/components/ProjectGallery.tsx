import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ProjectGalleryImage {
  src: string;
  alt: string;
}

/** Consecutive Markdown image lines share a gallery; there is no autoplay. */
export function ProjectGallery({ images }: { images: ProjectGalleryImage[] }) {
  const { t } = useTranslation();
  const trackId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [nearView, setNearView] = useState(false);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const multiple = images.length > 1;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => setNearView(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearView(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px 0px' });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !multiple) return;
    let timer: number | undefined;
    let previousWidth = track.clientWidth;
    const syncActive = () => {
      if (!track.clientWidth) return;
      const next = Math.max(0, Math.min(images.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
      activeRef.current = next;
      setActive((previous) => previous === next ? previous : next);
    };
    // Read the settled slide, not every scroll frame. Touch remains native.
    const handleScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(syncActive, 120);
    };
    const handleScrollEnd = () => {
      window.clearTimeout(timer);
      syncActive();
    };
    const handleResize = () => {
      const width = track.clientWidth;
      if (width && width !== previousWidth) {
        previousWidth = width;
        track.scrollTo({ left: activeRef.current * width, behavior: 'instant' });
      }
    };
    track.addEventListener('scroll', handleScroll, { passive: true });
    track.addEventListener('scrollend', handleScrollEnd, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : undefined;
    resizeObserver?.observe(track);
    if (!resizeObserver) window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.clearTimeout(timer);
      track.removeEventListener('scroll', handleScroll);
      track.removeEventListener('scrollend', handleScrollEnd);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', handleResize);
    };
  }, [images.length, multiple]);

  const navigate = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(images.length - 1, index));
    activeRef.current = next;
    setActive(next);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: next * track.clientWidth, behavior: reducedMotion ? 'instant' : 'smooth' });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined;
    if (event.key === 'ArrowLeft') next = activeRef.current - 1;
    if (event.key === 'ArrowRight') next = activeRef.current + 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = images.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      navigate(next);
    }
  };

  return <figure className="project-gallery" role="region" aria-label={t('project.gallery_title')}
    aria-roledescription={multiple ? t('project.gallery_carousel') : undefined}>
    <div id={trackId} ref={trackRef} className="project-gallery-track" role="group"
      aria-label={multiple ? t('project.gallery_keyboard') : t('project.gallery_title')}
      tabIndex={multiple ? 0 : undefined} onKeyDown={multiple ? onKeyDown : undefined}>
      {images.map((image, index) => <div key={`${index}-${image.src}`} className="project-gallery-slide"
        role="group" aria-roledescription={t('project.gallery_slide')}
        aria-label={t('project.gallery_count', { current: index + 1, count: images.length })}
        aria-hidden={index !== active} data-active={index === active}>
        {failed.has(index) ? <div className="project-gallery-error" role="img" aria-label={`${image.alt}: ${t('project.gallery_error')}`}>
          <ImageOff size={28} aria-hidden /><span>{t('project.gallery_error')}</span>
        </div> : nearView && Math.abs(index - active) <= 1 ? <img src={image.src} alt={image.alt}
          width={1600} height={900} loading="lazy" decoding="async"
          onError={() => setFailed((previous) => new Set(previous).add(index))} />
          : <span className="project-gallery-placeholder" aria-hidden><ImageIcon size={28} /></span>}
      </div>)}
    </div>
    <figcaption className="project-gallery-footer">
      <span className="project-gallery-caption">{images[active]?.alt}</span>
      {multiple && <div className="project-gallery-controls">
        <button type="button" className="hover-target project-gallery-button" aria-label={t('project.gallery_previous')}
          aria-controls={trackId} disabled={active === 0} onClick={() => navigate(activeRef.current - 1)}><ChevronLeft size={18} aria-hidden /></button>
        <span role="status" aria-live="polite" aria-atomic="true" className="project-gallery-count">{t('project.gallery_count', { current: active + 1, count: images.length })}</span>
        <button type="button" className="hover-target project-gallery-button" aria-label={t('project.gallery_next')}
          aria-controls={trackId} disabled={active === images.length - 1} onClick={() => navigate(activeRef.current + 1)}><ChevronRight size={18} aria-hidden /></button>
      </div>}
    </figcaption>
  </figure>;
}
