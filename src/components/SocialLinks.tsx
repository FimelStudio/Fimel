import { useTranslation } from 'react-i18next';
import qqIcon from '../icons/social/qq.svg';
import discordIcon from '../icons/social/discord.svg';
import xIcon from '../icons/social/x.svg';
import githubIcon from '../icons/social/github.svg';

const links = [
  { name: 'QQ', href: 'https://qm.qq.com/q/WVvNr3OocQ', icon: qqIcon },
  { name: 'Discord', href: 'https://discord.gg/X9aVJJVvA', icon: discordIcon },
  { name: 'X', href: 'https://x.com/FimelStudio', icon: xIcon },
  { name: 'GitHub', href: 'https://github.com/FimelStudio', icon: githubIcon },
];

export function SocialLinks() {
  const { t } = useTranslation();
  return <div role="group" aria-label={t('studioContact.social')} className="header-social col-start-2 row-start-1 flex items-center justify-self-end lg:mr-2 lg:border-r lg:border-line lg:pr-2">
    {links.map(({ name, href, icon }) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}
      className="hover-target inline-flex min-h-11 w-7 shrink-0 items-center justify-center text-content-muted outline-offset-2 transition-colors hover:bg-surface-raised hover:text-brand focus-visible:text-brand focus-visible:outline-2 focus-visible:outline-diamond lg:w-9">
      <span aria-hidden="true" className="social-icon block size-[18px] bg-current" style={{ maskImage: `url("${icon}")`, maskSize: 'contain', maskPosition: 'center', maskRepeat: 'no-repeat' }} />
    </a>)}
  </div>;
}
