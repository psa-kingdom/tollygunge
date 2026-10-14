import {SiteShell} from '@/components/site-shell';
import {HomeView} from '@/components/homepage-view';
import {HomepageMedia} from '@/components/public-media';
import {publishedSettings} from '@/lib/website-content';
export const dynamic='force-dynamic';
export default async function Home(){const home=await publishedSettings('home'),shared=await publishedSettings('shared');return <SiteShell><HomeView home={home} brandMark={shared.brandMark} media={<HomepageMedia copy={home.media}/>}/></SiteShell>;}
