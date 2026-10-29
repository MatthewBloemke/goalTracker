-- Movie additions now use title search through TMDB only. Remove the retired
-- case-photo AI quota ledger, function, and any grants issued for that feature.

drop function if exists public.consume_movie_case_analysis_quota();
drop table if exists public.movie_case_analysis_requests;

delete from public.feature_access_grants
where feature = 'movie_case_analysis';
