--
-- PostgreSQL database dump
--

\restrict ExsraXghOEYqbTulSlu23V8MQOzuVpJz2SAFaADT44kYDjAii3rbwltDbYwkobT

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid,
    gateway_transaction_id character varying(255),
    payment_status character varying(50),
    amount_paid numeric(10,2),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    room_id uuid,
    title character varying(255),
    item_type character varying(20) DEFAULT 'reservation'::character varying,
    qr_code text,
    qr_code_64 text,
    pix_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    payment_reminder_sent boolean DEFAULT false,
    cancellation_notice_sent boolean DEFAULT false
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: released_slots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.released_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.released_slots OWNER TO postgres;

--
-- Name: reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid,
    user_id uuid NOT NULL,
    booking_period tsrange NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    total_price numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    payment_reminder_sent boolean DEFAULT false,
    cancellation_notice_sent boolean DEFAULT false
);


ALTER TABLE public.reservations OWNER TO postgres;

--
-- Name: room_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.room_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    reason character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.room_blocks OWNER TO postgres;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    hourly_rate numeric(10,2) NOT NULL,
    shift_rate numeric(10,2) NOT NULL,
    capacity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    locked_by_default boolean DEFAULT false,
    photo1 text,
    photo2 text,
    photo3 text
);


ALTER TABLE public.rooms OWNER TO postgres;

--
-- Name: ticket_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid,
    title character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    qty integer NOT NULL,
    price numeric(10,2) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ticket_packages OWNER TO postgres;

--
-- Name: user_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_tickets (
    user_id uuid NOT NULL,
    room_id uuid NOT NULL,
    hourly_tickets integer DEFAULT 0,
    shift_tickets integer DEFAULT 0
);


ALTER TABLE public.user_tickets OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_admin boolean DEFAULT false,
    phone character varying(255),
    is_phone_verified boolean DEFAULT false,
    cpf character varying(20),
    cro character varying(50),
    address text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: verification_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code character varying(6) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.verification_codes OWNER TO postgres;

--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, reservation_id, gateway_transaction_id, payment_status, amount_paid, updated_at, user_id, room_id, title, item_type, qr_code, qr_code_64, pix_expires_at, created_at, payment_reminder_sent, cancellation_notice_sent) FROM stdin;
02bb4334-e76c-48f2-91a0-57856f3f999e	\N	151304841598	expired	270.00	2026-03-21 08:23:27.23161+00	0fa611b2-b287-4ad5-b793-d03408462b4b	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	1 Turno (C3)	package	00020126580014br.gov.bcb.pix0136561933af-f49c-49c1-b6a8-4b45c18bdbfd5204000053039865406270.005802BR5914THOMASAMARANTE6009Sao Paulo62250521mpqrinter151304841598630437BB	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	2026-03-21 08:43:25.974+00	2026-03-21 08:23:27.23161+00	t	t
cb8c77a7-ba0b-456c-8008-05586c4169f4	\N	150628283605	expired	270.00	2026-03-21 17:29:08.545727+00	0fa611b2-b287-4ad5-b793-d03408462b4b	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	1 Turno (C3)	package	00020126580014br.gov.bcb.pix0136561933af-f49c-49c1-b6a8-4b45c18bdbfd5204000053039865406270.005802BR5914THOMASAMARANTE6009Sao Paulo62250521mpqrinter1506282836056304E65A	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	2026-03-21 17:49:07.375+00	2026-03-21 17:29:08.545727+00	t	t
a3f430ce-a4d3-4783-8f05-e7a12f498316	\N	151374090914	expired	270.00	2026-03-21 19:46:14.316805+00	0fa611b2-b287-4ad5-b793-d03408462b4b	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	1 Turno (C3)	package	00020126580014br.gov.bcb.pix0136561933af-f49c-49c1-b6a8-4b45c18bdbfd5204000053039865406270.005802BR5914THOMASAMARANTE6009Sao Paulo62250521mpqrinter1513740909146304B859	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	2026-03-21 20:06:13.124+00	2026-03-21 19:46:14.316805+00	t	t
6ec77903-70f6-4828-8789-264f205bd263	\N	150648749793	expired	270.00	2026-03-21 20:19:40.160139+00	0fa611b2-b287-4ad5-b793-d03408462b4b	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	1 Turno (C3)	package	00020126580014br.gov.bcb.pix0136561933af-f49c-49c1-b6a8-4b45c18bdbfd5204000053039865406270.005802BR5914THOMASAMARANTE6009Sao Paulo62250521mpqrinter1506487497936304367E	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	2026-03-21 20:39:39+00	2026-03-21 20:19:40.160139+00	t	t
eb163b5d-7c5a-4db5-83b0-e84efaa26c9e	\N	151430691826	expired	270.00	2026-03-22 03:46:40.013526+00	0fa611b2-b287-4ad5-b793-d03408462b4b	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	1 Turno (C3)	package	00020126580014br.gov.bcb.pix0136561933af-f49c-49c1-b6a8-4b45c18bdbfd5204000053039865406270.005802BR5914THOMASAMARANTE6009Sao Paulo62250521mpqrinter151430691826630428AC	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	2026-03-22 04:06:38.807+00	2026-03-22 03:46:40.013526+00	t	t
\.


--
-- Data for Name: released_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.released_slots (id, room_id, date, start_time, end_time, created_at) FROM stdin;
8a9a482e-4786-472c-b089-bbd9d5a43112	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	2026-03-16	13:00:00	23:00:00	2026-03-13 00:02:43.024983+00
97cc170f-a303-439e-be49-25a122141c93	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	2026-03-20	08:00:00	12:00:00	2026-03-20 03:53:03.243501+00
\.


--
-- Data for Name: reservations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reservations (id, room_id, user_id, booking_period, status, total_price, created_at, payment_reminder_sent, cancellation_notice_sent) FROM stdin;
b258cf4d-862a-46b7-8f8a-03fabed405f9	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-11 13:00:00","2026-03-11 17:00:00")	cancelled	600.00	2026-03-07 20:02:53.751893+00	f	f
8e2a5c91-01b7-4192-bc3a-6c95d41c3109	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-20 13:00:00","2026-03-20 14:00:00")	confirmed	0.00	2026-03-20 03:13:07.97158+00	f	f
d4d21c63-b7a0-4914-9f7a-e2ac2b412c9f	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	dd8376c9-596f-4982-a94a-1b96d9a1f0b9	["2026-03-08 14:00:00","2026-03-08 18:00:00")	cancelled	500.00	2026-03-07 22:51:18.493881+00	t	f
3bbc23d9-2df8-488b-9193-768f0154c619	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	dd8376c9-596f-4982-a94a-1b96d9a1f0b9	["2026-03-09 10:00:00","2026-03-09 12:00:00")	cancelled	200.00	2026-03-07 22:58:36.77838+00	t	t
818bfd94-17e4-4095-ac8d-6a02c80a2c30	d93d2b37-3720-4298-b70b-aaf8a94acee0	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-20 10:30:00","2026-03-20 11:30:00")	confirmed	0.00	2026-03-20 03:13:51.89912+00	f	f
786ebae0-c576-4886-9591-3bd1d40bc694	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-09 09:00:00","2026-03-09 10:00:00")	cancelled	110.00	2026-03-07 23:16:47.458791+00	t	t
e56fd500-41b4-4d1b-8fc5-6daab177ce6c	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-16 09:00:00","2026-03-16 10:00:00")	cancelled	180.00	2026-03-09 03:04:26.731011+00	t	t
85cf8c45-f05a-4236-aa47-feb5e94016b6	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-20 10:30:00","2026-03-20 11:30:00")	confirmed	0.00	2026-03-20 03:14:42.94545+00	f	f
ac94b518-5e70-4e7b-821b-cb81ee73faef	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-10 10:00:00","2026-03-10 11:00:00")	cancelled	110.00	2026-03-10 03:08:46.08532+00	t	t
9c757769-d736-4096-8ba5-96ea3b650da4	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-20 11:30:00","2026-03-20 12:30:00")	confirmed	0.00	2026-03-20 03:17:03.890263+00	f	f
7f89521a-c846-42ef-b202-073aa76142aa	d93d2b37-3720-4298-b70b-aaf8a94acee0	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-11 07:00:00","2026-03-11 08:00:00")	cancelled	80.00	2026-03-10 03:28:50.941982+00	t	t
f4f58f35-7af9-4bdf-9ccc-34826aa3adad	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-20 10:30:00","2026-03-20 11:30:00")	confirmed	0.00	2026-03-20 03:53:27.141134+00	f	f
edc259f7-aefe-4f43-805b-fd9d60b17464	d93d2b37-3720-4298-b70b-aaf8a94acee0	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-18 20:00:00","2026-03-18 21:00:00")	cancelled	80.00	2026-03-10 03:48:25.338196+00	t	t
e736dbc1-73c3-4c09-bd6e-42e07b9295f8	d93d2b37-3720-4298-b70b-aaf8a94acee0	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-20 15:00:00","2026-03-20 20:00:00")	confirmed	0.00	2026-03-20 03:57:47.200785+00	f	f
60c836d1-5d4e-471f-a001-b661ac5bb2bc	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-10 07:00:00","2026-03-10 08:00:00")	cancelled	110.00	2026-03-10 23:46:57.315895+00	t	t
f0776c0b-dc92-4bb3-9533-0599bf812a11	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-10 07:00:00","2026-03-10 08:00:00")	cancelled	110.00	2026-03-11 01:37:08.784323+00	t	t
3ffabeae-c4fb-430f-8f00-ed89b1fcb320	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-11 14:00:00","2026-03-11 15:00:00")	cancelled	1.00	2026-03-11 02:12:18.828825+00	t	t
05b3a417-1dce-4c5c-9d74-6acba452b5a3	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-11 07:00:00","2026-03-11 08:00:00")	cancelled	1.00	2026-03-11 03:34:33.463445+00	t	t
9a91cf49-7f12-413c-b3e2-f3c65b697433	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-11 21:00:00","2026-03-11 22:00:00")	confirmed	0.00	2026-03-11 23:34:41.620697+00	f	f
da4fba8d-1414-448a-ad85-ce6e5507b52f	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-11 22:00:00","2026-03-11 23:00:00")	confirmed	0.00	2026-03-11 23:40:10.664755+00	f	f
df8d9995-8dde-4874-8e53-2df806ddec0a	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-20 18:00:00","2026-03-20 23:00:00")	cancelled	600.00	2026-03-11 23:52:05.966748+00	t	t
1ae5dfa3-30a9-428c-9527-7aae7ab673c5	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-13 15:00:00","2026-03-13 20:00:00")	cancelled	600.00	2026-03-12 03:02:45.133202+00	t	t
4e9c65ca-8d7b-4805-815f-6fdb96f40362	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-20 14:00:00","2026-03-20 19:00:00")	confirmed	0.00	2026-03-12 04:35:53.79962+00	f	f
7bb4c0a3-4bfd-44c6-b5bb-4b9d77ae1c1c	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-18 14:00:00","2026-03-18 19:00:00")	confirmed	0.00	2026-03-12 04:37:27.743792+00	f	f
d8cc621b-5867-4974-97ea-e050736b0808	d93d2b37-3720-4298-b70b-aaf8a94acee0	3b79579d-4939-465c-b5ca-1c5595ca7782	["2026-03-12 08:00:00","2026-03-12 13:00:00")	confirmed	0.00	2026-03-12 04:38:45.605185+00	f	f
83dda961-5e65-4e79-b1d8-6b621fbc26ac	d93d2b37-3720-4298-b70b-aaf8a94acee0	3b79579d-4939-465c-b5ca-1c5595ca7782	["2026-03-12 14:00:00","2026-03-12 15:00:00")	confirmed	0.00	2026-03-12 04:54:19.929233+00	f	f
c7ce99f6-b929-4bc7-a5fd-aca35fb85793	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-12 16:30:00","2026-03-12 17:30:00")	confirmed	0.00	2026-03-12 05:03:16.514567+00	f	f
98c2e496-3a4e-4d55-9886-bc60324ade0e	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-14 10:30:00","2026-03-14 11:30:00")	cancelled	0.00	2026-03-14 06:23:32.960736+00	f	f
e9e89517-ebe2-4026-9c8c-97c385c463a6	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-20 16:30:00","2026-03-20 17:30:00")	confirmed	0.00	2026-03-20 03:01:03.866986+00	f	f
\.


--
-- Data for Name: room_blocks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.room_blocks (id, room_id, date, start_time, end_time, reason, created_at) FROM stdin;
8d9df588-ee34-4374-8aa7-d7e8bfdede77	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	2026-03-22	07:00:00	23:00:00	Pintura e reforma	2026-03-22 05:17:35.622429+00
1e247bb5-7a46-4421-b239-d52d2b18bf15	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	2026-03-23	07:00:00	23:00:00		2026-03-22 05:20:39.586052+00
953c3f86-d295-4623-9a77-9dee5aa8189d	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	2026-03-24	07:00:00	23:00:00		2026-03-22 05:21:20.424487+00
eba1ac59-0bd1-47ad-8671-45a0ad2fb5ef	d93d2b37-3720-4298-b70b-aaf8a94acee0	2026-03-25	07:00:00	23:00:00		2026-03-22 05:24:43.643414+00
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rooms (id, name, description, hourly_rate, shift_rate, capacity, created_at, locked_by_default, photo1, photo2, photo3) FROM stdin;
c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	Consultório 1	Sala com uma excelente infraestrurtura para suas consultas.	1.00	260.00	3	2026-03-04 04:15:19.770049+00	f	http://localhost:3001/uploads/photo-1773982836341-645111960.png	http://localhost:3001/uploads/photo-1773982839625-829463225.png	http://localhost:3001/uploads/photo-1773982844731-950024189.png
d93d2b37-3720-4298-b70b-aaf8a94acee0	Consultório 2	Sala com uma excelente infraestrurtura para suas consultas.	80.00	280.00	3	2026-03-04 04:15:19.769616+00	f	http://localhost:3001/uploads/photo-1773982854332-680808846.png	http://localhost:3001/uploads/photo-1773982857281-929329716.png	http://localhost:3001/uploads/photo-1773982861456-626592981.png
0b5d4bf5-b66b-43bf-9575-0ca9925251f4	Consultório 3	Consultorio completo com equipamentos de ponta, oferecendo o melhor atendimento aos seus clientes.	90.00	600.00	4	2026-03-04 04:15:19.768064+00	t	http://localhost:3001/uploads/photo-1773982806200-510544831.png	http://localhost:3001/uploads/photo-1773982809526-335354955.png	http://localhost:3001/uploads/photo-1773982812462-663203537.png
\.


--
-- Data for Name: ticket_packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ticket_packages (id, room_id, title, type, qty, price, description, is_active, created_at) FROM stdin;
68a1aacc-bcad-449c-8318-ff896599541a	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	Avulso 1 Hora (C1)	hourly	1	90.00	Ideal para consultas rápidas.	t	2026-03-11 03:52:35.221816+00
fa1b4402-de31-4d15-9425-10f8a2daf401	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	1 Turno (C1)	shift	1	250.00	5 horas exclusivas.	t	2026-03-11 03:52:35.221816+00
3729aff6-9d76-4753-9c6d-a11e2357c3c0	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	Pacote 4 Turnos	shift	4	950.00	R$ 237,50 / turno	t	2026-03-11 03:52:35.221816+00
08aa4e57-b274-446b-a99d-a23b45921610	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	Pacote 8 Turnos	shift	8	1800.00	R$ 225,00 / turno	t	2026-03-11 03:52:35.221816+00
c34ff034-0383-4f0d-8c03-7c5d397e7867	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	Pacote 12 Turnos	shift	12	2550.00	Maior Desconto: R$ 212,50 / turno	t	2026-03-11 03:52:35.221816+00
03a4a871-0825-4569-a381-f220342a0a7b	d93d2b37-3720-4298-b70b-aaf8a94acee0	Avulso 1 Hora (C2)	hourly	1	70.00	Hora avulsa	t	2026-03-11 03:52:35.221816+00
59d4b818-4bee-47b0-8e65-ccb09b956ff3	d93d2b37-3720-4298-b70b-aaf8a94acee0	1 Turno (C2)	shift	1	230.00	5 horas exclusivas	t	2026-03-11 03:52:35.221816+00
1522fad8-cba6-4c6e-991f-08a0dc9d996b	d93d2b37-3720-4298-b70b-aaf8a94acee0	Pacote 4 Turnos	shift	4	874.00	R$ 218,50 / turno	t	2026-03-11 03:52:35.221816+00
d8187c06-1287-4786-9704-0fac1e346225	d93d2b37-3720-4298-b70b-aaf8a94acee0	Pacote 8 Turnos	shift	8	1656.00	R$ 207,00 / turno	t	2026-03-11 03:52:35.221816+00
b62a407a-e70c-4524-82f0-81da0cc83bd7	d93d2b37-3720-4298-b70b-aaf8a94acee0	Pacote 12 Turnos	shift	12	2346.00	R$ 195,50 / turno	t	2026-03-11 03:52:35.221816+00
c5be221b-4a5b-43ed-9493-61227daf4bc6	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	Avulso 1 Hora (C3)	hourly	1	100.00	Hora avulsa para a sala especial.	t	2026-03-11 03:52:35.221816+00
70e9d9ee-307a-47f5-af62-bcae1838ccf3	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	1 Turno (C3)	shift	1	270.00	5 horas na Sala Carina Cigolini.	t	2026-03-11 03:52:35.221816+00
\.


--
-- Data for Name: user_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_tickets (user_id, room_id, hourly_tickets, shift_tickets) FROM stdin;
0fa611b2-b287-4ad5-b793-d03408462b4b	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	88	0
3b79579d-4939-465c-b5ca-1c5595ca7782	d93d2b37-3720-4298-b70b-aaf8a94acee0	2	0
3b79579d-4939-465c-b5ca-1c5595ca7782	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	1	0
0fa611b2-b287-4ad5-b793-d03408462b4b	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	3	3
f4514731-440a-4aa7-9bb6-7df6c73ee37c	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	99993	99998
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, created_at, is_admin, phone, is_phone_verified, cpf, cro, address) FROM stdin;
0fa611b2-b287-4ad5-b793-d03408462b4b	Thomas Ferreira	thomasferreiraa@gmail.com	$2b$10$EUDuwcDhhfsrm7kOJ2SJsOFGkv/FXMUuBLWqL3gzvveQQk2ubFzyy	2026-03-07 04:44:42.295452+00	f	51999633361	t	\N	\N	\N
3b79579d-4939-465c-b5ca-1c5595ca7782	Kauana Dahmer	kauana.dahmer@outlook.com	$2b$10$/OljYfzb20HF4K2A8xyev.yP7YYEhNV3sO96lb2May2uJW/HTFwsi	2026-03-07 04:44:42.357888+00	f	51985364844	t	\N	\N	\N
f4514731-440a-4aa7-9bb6-7df6c73ee37c	Carina Cigolini	carina@liv.com	$2b$10$YQ.AZocpVeLyF7X1MfZRR.CIVcTxu1Mk1dLx4PPotc0Afzj4GYwna	2026-03-07 04:44:42.245449+00	t	51999633361	t	\N	\N	\N
a6d82eaf-b3d3-46bb-b0ae-ff8466105d06	Admin	admin@liv.com	$2b$10$XOScAHUohvnhyY2ahoGsOuG6CmiCa2IiAiKKSrnWAH/1zCaoplPN.	2026-03-04 04:28:49.09673+00	t	51999633361	t	\N	\N	\N
b5c7284b-2c76-4989-9516-3090a3119667	Usuário teste	usuario@liv.com	$2b$10$m/wES0CUZN2VdM.xaFYRLOJ6iNRPdY9pZV292L4Gk3ykNE5RX5v5W	2026-03-07 21:19:14.534728+00	f	5551999633361	t	\N	\N	\N
1ce70c10-e29d-404c-b33a-10467fdf2042	User Phone Test	phone_test@example.com	$2b$10$ehnOpmR16ipmkADf3213ZeGO2Hzns8fDbQDAr2aFt0eqEtnUt0F5e	2026-03-07 21:52:04.832465+00	f	5551999999999	t	\N	\N	\N
1f0e208d-409f-4aee-81b8-cbe5014daeb5	User Phone Test 2	phone_test2@example.com	$2b$10$L.ih0PUqxnWyrHwtRGzWLe4Q.9xoVmc1tm1DnlRghiVh1LICcgPha	2026-03-07 21:53:20.166196+00	f	5551999999998	t	\N	\N	\N
\.


--
-- Data for Name: verification_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification_codes (id, user_id, code, expires_at, created_at) FROM stdin;
4bbfb361-8b8b-400a-8eaa-ec6cafde84a0	b5c7284b-2c76-4989-9516-3090a3119667	668868	2026-03-07 21:34:14.536+00	2026-03-07 21:19:14.536915+00
64e94616-df16-41a1-b2b2-bca02d3eafd8	1ce70c10-e29d-404c-b33a-10467fdf2042	398573	2026-03-07 22:07:04.834+00	2026-03-07 21:52:04.834201+00
9d81b8ba-fbcf-457b-9c9f-0d5c4aefb023	1f0e208d-409f-4aee-81b8-cbe5014daeb5	270389	2026-03-07 22:08:20.169+00	2026-03-07 21:53:20.170124+00
\.


--
-- Name: payments payments_gateway_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_gateway_transaction_id_key UNIQUE (gateway_transaction_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: released_slots released_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.released_slots
    ADD CONSTRAINT released_slots_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_room_id_booking_period_excl; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_room_id_booking_period_excl EXCLUDE USING gist (room_id WITH =, booking_period WITH &&) WHERE (((status)::text <> 'cancelled'::text));


--
-- Name: room_blocks room_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_blocks
    ADD CONSTRAINT room_blocks_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: ticket_packages ticket_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_packages
    ADD CONSTRAINT ticket_packages_pkey PRIMARY KEY (id);


--
-- Name: user_tickets user_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tickets
    ADD CONSTRAINT user_tickets_pkey PRIMARY KEY (user_id, room_id);


--
-- Name: users users_cpf_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_cpf_key UNIQUE (cpf);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_codes verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT verification_codes_pkey PRIMARY KEY (id);


--
-- Name: payments payments_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: payments payments_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: released_slots released_slots_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.released_slots
    ADD CONSTRAINT released_slots_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: reservations reservations_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: room_blocks room_blocks_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_blocks
    ADD CONSTRAINT room_blocks_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: ticket_packages ticket_packages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_packages
    ADD CONSTRAINT ticket_packages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: user_tickets user_tickets_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tickets
    ADD CONSTRAINT user_tickets_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: user_tickets user_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tickets
    ADD CONSTRAINT user_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_codes verification_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ExsraXghOEYqbTulSlu23V8MQOzuVpJz2SAFaADT44kYDjAii3rbwltDbYwkobT

