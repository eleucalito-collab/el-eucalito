import streamlit as st
import pandas as pd
import plotly.express as px
import google.generativeai as genai
from datetime import date
import gspread
from google.oauth2.service_account import Credentials
import requests
import json

primos = ["Pablo", "Camila", "Marie", "Marian", "Rorro", "Martín", "Carolina", "Tony", "Joaquín", "Mica", "Nico", "Pauli"]

st.set_page_config(page_title="El Eucalito", layout="wide")
st.title("🌴 Contabilidad Familiar - El Eucalito")

scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
creds = Credentials.from_service_account_info(st.secrets["gcp_service_account"], scopes=scopes)
gc = gspread.authorize(creds)

# TU SHEET EXACTO
spreadsheet = gc.open_by_key("1S3IefMfXZXbL-dQyNe_-QfUUoo6a9toMEfm-47HNQNQ")
trans_sheet = spreadsheet.worksheet("Transacciones")

if not trans_sheet.row_values(1):
    trans_sheet.update('A1:I1', [["fecha","descripcion","monto","moneda","monto_usd","categoria","tipo","pagado_por","beneficiario"]])

@st.cache_data(ttl=3600)
def get_rate(fecha="latest"):
    url = f"https://api.exchangerate.host/{fecha}?base=USD&symbols=UYU"
    try:
        return requests.get(url).json()["rates"]["UYU"]
    except:
        return 42.0

tasa_hoy = get_rate()
st.sidebar.success(f"🇺🇾 Cotización hoy: 1 USD = {tasa_hoy:.2f} UYU")

if st.sidebar.button("Actualizar histórico con tasas reales"):
    with st.spinner("Recalculando..."):
        records = trans_sheet.get_all_records()
        updates = []
        for i, row in enumerate(records, start=2):
            if row.get("moneda", "").upper() == "UYU":
                rate = get_rate(row.get("fecha", "latest"))
                nuevo_usd = round(float(row["monto"]) / rate, 4)
                updates.append({"range": f"E{i}", "values": [[nuevo_usd]]})
        if updates:
            trans_sheet.batch_update(updates)
    st.sidebar.success("¡Histórico actualizado!")

df = pd.DataFrame(trans_sheet.get_all_records())
if not df.empty:
    df["monto"] = pd.to_numeric(df["monto"], errors="coerce").fillna(0)
    df["monto_usd"] = pd.to_numeric(df["monto_usd"], errors="coerce").fillna(0)

total_ingresos = df[df["tipo"] == "Ingreso"]["monto_usd"].sum()
total_gastos = df[df["tipo"] == "Gasto"]["monto_usd"].sum()
balance_actual = total_ingresos - total_gastos

balances = pd.Series(0.0, index=primos)
if not df.empty:
    balances += df[(df["tipo"] == "Gasto") & (df["pagado_por"].isin(primos))].groupby("pagado_por")["monto_usd"].sum()
    balances += df[df["tipo"] == "Préstamo a Casa"].groupby("pagado_por")["monto_usd"].sum()
    balances -= df[df["tipo"] == "Préstamo a Primo"].groupby("beneficiario")["monto_usd"].sum()

tab1, tab2, tab3, tab4 = st.tabs(["Dashboard", "Nueva Transacción", "Categorías", "Transacciones"])

with tab1:
    c1, c2, c3 = st.columns(3)
    c1.metric("Ingresos", f"${total_ingresos:,.2f}")
    c2.metric("Gastos", f"${total_gastos:,.2f}")
    c3.metric("Caja", f"${balance_actual:,.2f}")

    st.header("Estado de cuentas")
    cols = st.columns(3)
    for i, primo in enumerate(primos):
        with cols[i % 3]:
            valor = balances.get(primo, 0)
            st.metric(primo, f"${valor:,.2f}", delta_color="normal" if valor >= 0 else "inverse")

    gastos = df[df["tipo"] == "Gasto"]
    if not gastos.empty:
        fig = px.pie(gastos, values="monto_usd", names="categoria", title="Gastos por categoría")
        st.plotly_chart(fig, use_container_width=True)

    csv = df.to_csv(index=False).encode()
    st.download_button("Descargar Excel", csv, "el_eucalito.csv", "text/csv")

with tab2:
    st.header("Nueva Transacción")

    api_key = st.text_input("API Key Gemini", type="password", value=st.session_state.get("gemini_key", ""))
    if api_key:
        st.session_state.gemini_key = api_key
        genai.configure(api_key=api_key)

    texto = st.text_area("Ingreso inteligente", height=120, placeholder="Ej: Rorro pagó 1600 pesos camión fosa ayer")

    if st.button("Procesar con IA", type="primary") and texto and api_key:
        prompt = f"""
        Hoy es {date.today()}.
        Extrae SOLO JSON válido con estas claves exactas:
        fecha (YYYY-MM-DD), descripcion, monto, moneda ("UYU" o "USD"), categoria, tipo ("Ingreso" o "Gasto" o "Préstamo a Casa" o "Préstamo a Primo"), pagado_por, beneficiario (o "")
        Texto: {texto}
        """
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            data = json.loads(response.text)

            rate = get_rate(data.get("fecha", str(date.today())))
            monto_usd = data["monto"] if data["moneda"].upper() == "USD" else round(data["monto"] / rate, 4)

            trans_sheet.append_row([
                data.get("fecha", str(date.today())),
                data["descripcion"],
                data["monto"],
                data["moneda"].upper(),
                monto_usd,
                data.get("categoria", ""),
                data["tipo"],
                data["pagado_por"],
                data.get("beneficiario", "")
            ])
            st.success(f"Agregado! Tasa: {rate:.2f}")
            st.rerun()
        except Exception as e:
            st.error(f"Error: {e}")

    st.markdown("---")
    st.subheader("Manual")
    with st.form("manual"):
        tipo = st.selectbox("Tipo", ["Ingreso", "Gasto", "Préstamo a Casa", "Préstamo a Primo"])
        fecha = st.date_input("Fecha", date.today())
        descripcion = st.text_input("Descripción")
        monto = st.number_input("Monto", min_value=0.0)
        moneda = st.selectbox("Moneda", ["USD", "UYU"])
        categoria = st.text_input("Categoría")
        pagado_por = st.selectbox("Pagado por", ["Airbnb", "El Eucalito"] + primos)
        beneficiario = st.selectbox("Beneficiario", [""] + primos)

        if st.form_submit_button("Agregar"):
            rate = get_rate(str(fecha))
            monto_usd = monto if moneda == "USD" else round(monto / rate, 4)
            trans_sheet.append_row([str(fecha), descripcion, monto, moneda, monto_usd, categoria, tipo, pagado_por, beneficiario if tipo == "Préstamo a Primo" else ""])
            st.success("¡Agregado!")
            st.rerun()

with tab3:
    st.header("Reporte por Categorías")
    gastos = df[df["tipo"] == "Gasto"]
    for cat in gastos["categoria"].dropna().unique():
        sub = gastos[gastos["categoria"] == cat]
        with st.expander(f"{cat} → ${sub['monto_usd'].sum():,.2f}"):
            sub_show = sub[["fecha", "descripcion", "monto_usd", "pagado_por"]].copy()
            sub_show["fecha"] = pd.to_datetime(sub_show["fecha"]).dt.strftime("%d/%m/%Y")
            sub_show["monto_usd"] = sub_show["monto_usd"].apply(lambda x: f"${x:,.2f}")
            st.dataframe(sub_show, use_container_width=True, hide_index=True)

with tab4:
    st.header("Todas las transacciones")
    if not df.empty:
        df_show = df.copy()
        df_show["fecha"] = pd.to_datetime(df_show["fecha"]).dt.strftime("%d/%m/%Y")
        df_show["monto_usd"] = df_show["monto_usd"].apply(lambda x: f"${x:,.2f}")
        st.dataframe(df_show[["fecha","descripcion","monto","moneda","monto_usd","categoria","tipo","pagado_por","beneficiario"]], use_container_width=True, hide_index=True)
    else:
        st.info("Aún no hay transacciones")
