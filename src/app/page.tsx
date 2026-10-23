import {SiteShell} from '@/components/site-shell';
import {HomeView} from '@/components/homepage-view';
import {HomepageEvents} from '@/components/homepage-events';
import {publishedSettings} from '@/lib/website-content';
export const dynamic='force-dynamic';
export default async function Home(){const home=await publishedSettings('home'),shared=await publishedSettings('shared');return <SiteShell variant="v3"><HomeView home={home} brandMark={shared.brandMark} events={<HomepageEvents heading={home.copy.sectionHeading37}/>}/></SiteShell>;}
