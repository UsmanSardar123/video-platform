import { Redirect } from 'expo-router';

// Keep the original top-level Explore URL valid for existing links and deep links.
export default function ExploreRoute() {
  return <Redirect href="/main/explore" />;
}
