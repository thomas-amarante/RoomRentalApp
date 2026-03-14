--
-- PostgreSQL database dump
--

\restrict ceHAm6hK0shabJhKOhwf8fcAkk5NAbtGYcouGNd6f83nCsuqwxk6uPCKnaZH1oJ

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
    updated_at timestamp with time zone DEFAULT now()
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
    locked_by_default boolean DEFAULT false
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

COPY public.payments (id, reservation_id, gateway_transaction_id, payment_status, amount_paid, updated_at) FROM stdin;
\.


--
-- Data for Name: released_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.released_slots (id, room_id, date, start_time, end_time, created_at) FROM stdin;
8a9a482e-4786-472c-b089-bbd9d5a43112	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	2026-03-16	13:00:00	23:00:00	2026-03-13 00:02:43.024983+00
\.


--
-- Data for Name: reservations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reservations (id, room_id, user_id, booking_period, status, total_price, created_at, payment_reminder_sent, cancellation_notice_sent) FROM stdin;
b258cf4d-862a-46b7-8f8a-03fabed405f9	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-11 13:00:00","2026-03-11 17:00:00")	cancelled	600.00	2026-03-07 20:02:53.751893+00	f	f
d4d21c63-b7a0-4914-9f7a-e2ac2b412c9f	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	dd8376c9-596f-4982-a94a-1b96d9a1f0b9	["2026-03-08 14:00:00","2026-03-08 18:00:00")	cancelled	500.00	2026-03-07 22:51:18.493881+00	t	f
3bbc23d9-2df8-488b-9193-768f0154c619	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	dd8376c9-596f-4982-a94a-1b96d9a1f0b9	["2026-03-09 10:00:00","2026-03-09 12:00:00")	cancelled	200.00	2026-03-07 22:58:36.77838+00	t	t
786ebae0-c576-4886-9591-3bd1d40bc694	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-09 09:00:00","2026-03-09 10:00:00")	cancelled	110.00	2026-03-07 23:16:47.458791+00	t	t
e56fd500-41b4-4d1b-8fc5-6daab177ce6c	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	f4514731-440a-4aa7-9bb6-7df6c73ee37c	["2026-03-16 09:00:00","2026-03-16 10:00:00")	cancelled	180.00	2026-03-09 03:04:26.731011+00	t	t
ac94b518-5e70-4e7b-821b-cb81ee73faef	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-10 10:00:00","2026-03-10 11:00:00")	cancelled	110.00	2026-03-10 03:08:46.08532+00	t	t
7f89521a-c846-42ef-b202-073aa76142aa	d93d2b37-3720-4298-b70b-aaf8a94acee0	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-11 07:00:00","2026-03-11 08:00:00")	cancelled	80.00	2026-03-10 03:28:50.941982+00	t	t
edc259f7-aefe-4f43-805b-fd9d60b17464	d93d2b37-3720-4298-b70b-aaf8a94acee0	0fa611b2-b287-4ad5-b793-d03408462b4b	["2026-03-18 20:00:00","2026-03-18 21:00:00")	cancelled	80.00	2026-03-10 03:48:25.338196+00	t	t
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
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rooms (id, name, description, hourly_rate, shift_rate, capacity, created_at, locked_by_default) FROM stdin;
c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	Consultório 1	Sala com um excelente infraestrurtura para suas consultas.	1.00	260.00	3	2026-03-04 04:15:19.770049+00	f
d93d2b37-3720-4298-b70b-aaf8a94acee0	Consultório 2	Sala com um excelente infraestrurtura para suas consultas.	80.00	280.00	3	2026-03-04 04:15:19.769616+00	f
0b5d4bf5-b66b-43bf-9575-0ca9925251f4	Consultório Carina Cigolini	Consultorio completo com equipamentos de ponta, oferecendo o melhor atendimento aos seus clientes.	90.00	600.00	4	2026-03-04 04:15:19.768064+00	t
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
0fa611b2-b287-4ad5-b793-d03408462b4b	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	4	3
f4514731-440a-4aa7-9bb6-7df6c73ee37c	0b5d4bf5-b66b-43bf-9575-0ca9925251f4	99999	99999
3b79579d-4939-465c-b5ca-1c5595ca7782	c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96	1	0
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

\unrestrict ceHAm6hK0shabJhKOhwf8fcAkk5NAbtGYcouGNd6f83nCsuqwxk6uPCKnaZH1oJ

