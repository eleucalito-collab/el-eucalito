import streamlit as st
import pandas as pd
import plotly.express as px
import google.generativeai as genai
from datetime import date
import gspread
from google.oauth2.service_account import Credentials

# === Lista de los 12 primos ===
primos = ["Pablo", "Camila", "Marie", "Marian", "Rorro", "Martín", "Carolina", "Tony", "Joaquín", "Mica", "Nico", "Pauli"]

# === Configuración página ===
st.set_page_config(page_title="El Eucalito", layout="wide")
st.title("🌴 Contabilidad Familiar - El Eucalito")

# === Conexión con Google Sheets (AHORA POR ID → NUNCA MÁS FALLA) ===
creds = Credentials.from_service_account_info(
    st.secrets["gcp_service_account"],
    scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
)
gc = gspread.authorize(creds)

# ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
# TU ID REAL (el que me pasaste)
SPREADSHEET_ID = "1S3IefMfXZXbL-dQyNe_-QfUUoo6a9toMEfm-47HNQNQ"
spreadsheet = gc.open_by_key(SPREADSHEET_ID)
# ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

trans_sheet = spreadsheet.worksheet("Transacciones")
config_sheet = spreadsheet.worksheet("Config")

# === Tasa de cambio ===
try:
    tasa = float(config_sheet.cell(1, 2).value or 42.0)
except:
    tasa = 42.0

new_tasa = st.sidebar.number_input("Tasa UYU → USD", value=tasa, step=0.1, format="%.2f")
if new_tasa != tasa:
    if st.sidebar.button("💾 Guardar nueva tasa"):
        config_sheet.update("B1", [[new_tasa]])
        st.sidebar.success(f"Tasa actualizada a {new_tasa}")
        st.rerun()

# === Cargar transacciones ===
records = trans_sheet.get_all_records()
df = pd.DataFrame(records)

if not df.empty:
    df["monto"] = pd.to_numeric(df["monto"], errors="coerce").fillna(0)
    df["monto_usd"] = pd.to_numeric(df["monto_usd"], errors="coerce").fillna(0)
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce", dayfirst=True)

# Si está vacío, crea las cabeceras
if df.empty and len(trans_sheet.row_values(1)) == 0:
    trans_sheet.update('A1:I1', [["fecha","descripcion","monto","moneda","monto_usd","categoria","tipo","pagado_por","beneficiario"]])

# === Cálculos ===
total_ingresos = df[df["tipo"] == "Ingreso"]["monto_usd"].sum()
total_gastos = df[df["tipo"] == "Gasto"]["monto_usd"].sum()
balance_caja = total_ingresos - total_gastos

balances = pd.Series(0.0, index=primos)
# Gastos pagados por primos (la casa les debe)
balances += df[(df["tipo"] == "Gasto") & (df["pagado_por"].isin(primos))].groupby("pagado_por")["monto_usd"].sum()
# Préstamos de primos a la casa
balances += df[df["tipo"] == "Préstamo a Casa"].groupby("pagado_por")["monto_usd"].sum()
# Préstamos de la casa a primos (primos deben)
balances -= df[df["tipo"] == "Préstamo a Primo"].groupby("beneficiario")["monto_usd"].sum()

# === Pestañas ===
tab1, tab2, tab3 = st.tabs(["🏠 Dashboard", "✏️ Nueva Transacción", "📊 Por Categorías"])

with tab1:
    c1, c2, c3 = st.columns(3)
    c1.metric("Ingresos totales", f"${total_ingresos:,.2f}")
    c2.metric("Gastos totales", f"${total_gastos:,.2f}")
    c3.metric("Balance caja", f"${balance_caja:,.2f}", delta_color="normal" if balance_caja >= 0 else "inverse")

    st.subheader("Saldo con cada primo")
    cols = st.columns(3)
    for i, primo in enumerate(primos):
        saldo = balances.get(primo, 0.0)
        with cols[i % 3]:
            st.metric(primo, f"${saldo:,.2f}", delta_color="normal" if saldo >= 0 else "inverse")

    gastos = df[df["tipo"] == "Gasto"]
    if not gastos.empty and gastos["categoria"].notna().any():
        fig = px.pie(gastos, values="monto_usd", names="categoria", title="Gastos por categoría")
        st.plotly_chart(fig, use_container_width=True)

with tab2:
    st.header("Ingreso Inteligente con IA")
    api_key = st.text_input("🔑 API Key Gemini (gemini-1.5-flash)", type="password",
                            help="Sacala gratis acá → https://aistudio.google.com/app/apikey")
    if api_key:
        st.session_state.gemini_key = api_key
        genai.configure(api_key=api_key)

    texto = st.text_area("Escribí lo que pasó (como si fuera un WhatsApp)", height=150,
                         placeholder="Ej: Rorro pagó 1600 pesos del camión fosa ayer\nEntraron 450 dólares del alquiler\nLa casa le prestó 100 dólares a Nico")

    if st.button("🚀 Procesar con IA", type="primary") and texto and api_key:
        with st.spinner("La IA está leyendo..."):
            prompt = f"""
            Convertí esta frase en un JSON perfecto con estas claves exactas:
            fecha (YYYY-MM-DD, hoy si no dice)
            descripcion
            monto (solo número)
            moneda ("UYU" o "USD")
            categoria
            tipo ("Ingreso", "Gasto", "Préstamo a Casa", "Préstamo a Primo")
            pagado_por
            beneficiario

            Frase: {texto}

            Reglas:
            - Si un primo pagó algo de la casa → "Gasto", pagado_por: primo, beneficiario: "El Eucalito"
            - Si entra plata → "Ingreso", pagado_por: "Airbnb", beneficiario: "El Eucalito"
            - Si un primo presta a la casa → "Préstamo a Casa"
            - Si la casa presta a un primo → "Préstamo a Primo"

            SOLO el JSON, nada más.
            """
            try:
                model = genai.GenerativeModel("gemini-1.5-flash")
                response = model.generate_content(prompt)
                data = eval(response.text.strip("`").replace("json", ""))

                monto = float(data["monto"])
                moneda = data["moneda"].upper()
                monto_usd = round(monto / tasa, 4) if moneda == "UYU" else monto

                trans_sheet.append_row([
                    data.get("fecha", str(date.today())),
                    data["descripcion"],
                    monto,
                    moneda,
                    monto_usd,
                    data.get("categoria", ""),
                    data["tipo"],
                    data["pagado_por"],
                    data.get("beneficiario", "")
                ])
                st.success(f"¡Agregado! {data['descripcion']}")
                st.balloons()
                st.rerun()
            except Exception as e:
                st.error(f"Error: {e}")

with tab3:
    st.header("Gastos por categoría")
    gastos = df[df["tipo"] == "Gasto"]
    if not gastos.empty:
        for cat in sorted(gastos["categoria"].dropna().unique()):
            sub = gastos[gastos["categoria"] == cat]
            with st.expander(f"{cat} – Total ${sub['monto_usd'].sum():,.2f}"):
                st.dataframe(sub[["fecha", "descripcion", "monto_usd", "pagado_por"]].sort_values("fecha", ascending=False))
    else:
        st.info("Aún no hay gastos")
