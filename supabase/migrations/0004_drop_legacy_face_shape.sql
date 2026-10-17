-- Drop the original face shape column.
--
-- It was written by nothing: the client has always stored the reading in
-- face_profiles (0003), so the chat function reading this column always got
-- null and Trimo told every customer their face had never been measured.
--
-- It was also wrong. The check constraint allowed oval, round, square, heart
-- and oblong, while the analyzer classifies seven shapes and has no oblong
-- among them. Two sources of truth that disagreed on the vocabulary.

alter table public.profiles drop column if exists face_shape;