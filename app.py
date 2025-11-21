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

tab1, tab2, tab3, tab4 = st.tabs(["Dashboard", "Nueva", "Categorías", "Transacciones"])

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
        fig = px.pie(gastos, values="monto_usd", names="categoria")
        st.plotly_chart(fig, use_container_width=True)

    csv = df.to_csv(index=False).encode()
    st.download_button("Descargar Excel", csv, "el_eucalito.csv")

with tab2:
    api_key = st.text_input("API Key Gemini", type="password", value=st.session_state.get("gemini_key", ""))
    if api_key:
        st.session_state.gemini_key = api_key
        genai.configure(api_key=api_key)

    texto = st.text_area("Ingreso inteligente", height=120)

    if st.button("Procesar con IA", type="primary") and texto and api_key:
        # el prompt completo de antes
        # ...
        # (el mismo código de IA que funcionaba)

# etc, el resto igual

# (para no hacer el mensaje eterno, el código es el mismo de antes pero con open_by_key y tu ID)
