import streamlit as st
import gspread
from google.oauth2.service_account import Credentials

st.set_page_config(page_title="El Eucalito", layout="wide")
st.title("🌴 El Eucalito – Prueba de conexión")

# CONEXIÓN CON EL SHEET QUE SÍ FUNCIONA
creds = Credentials.from_service_account_info(
    st.secrets["gcp_service_account"],
    scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
)
gc = gspread.authorize(creds)

# ID NUEVO DE LA COPIA QUE CREASTE (ESTE FUNCIONA)
SPREADSHEET_ID = "10tKSl7kulZ70Z95pNe7IBAiHyYV9xYPvEyNvWyIBwlY"
spreadsheet = gc.open_by_key(SPREADSHEET_ID)

st.success("¡CONECTADO PERFECTO! EL SHEET NUEVO FUNCIONA 100% 🎉🎉🎉")
st.balloons()

trans_sheet = spreadsheet.worksheet("Transacciones")
st.write("Datos actuales en la hoja Transacciones:")
st.dataframe(trans_sheet.get_all_records())
