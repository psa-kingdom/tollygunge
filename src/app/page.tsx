import {SiteShell} from '@/components/site-shell';
import {HomeView} from '@/components/homepage-view';
import {HomepageEvents} from '@/components/homepage-events';
import {publishedSettings} from '@/lib/website-content';
import { publicMetadata, safeJsonLd, siteOrigin } from '@/domain/public-metadata';
export const dynamic='force-dynamic';
export async function generateMetadata(){const shared=await publishedSettings('shared');return {...publicMetadata('/',shared.defaultTitle,shared.defaultDescription),title:{absolute:shared.defaultTitle}};}
export default async function Home(){const [home, shared] = await Promise.all([publishedSettings('home'), publishedSettings('shared')]);return <SiteShell variant="v3"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd({'@context':'https://schema.org','@type':'Organization',name:shared.organisation.replace(/\s+/g,' ').trim(),url:siteOrigin,logo:`${siteOrigin}/design/tpa-logo.png`})}}/><HomeView home={home} brandMark={shared.brandMark} events={<HomepageEvents heading={home.copy.sectionHeading37}/>}/></SiteShell>;}
