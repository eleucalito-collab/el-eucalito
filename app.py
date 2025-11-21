import streamlit as st
import gspread
from google.oauth2.service_account import Credentials

st.title("🌴 El Eucalito – Prueba de conexión")

# Conexión con el Sheet nuevo (el que sí funciona)
creds = Credentials.from_service_account_info(
    st.secrets["gcp_service_account"],
    scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
)
gc = gspread.authorize(creds)

SPREADSHEET_ID = "1FSarYjk_pUTkKCi9R1-S9pmIY2E14yJcqDWHjpONduQ"
spreadsheet = gc.open_by_key(SPREADSHEET_ID)

trans_sheet = spreadsheet.worksheet("Transacciones")
config_sheet = spreadsheet.worksheet("Config")

st.success("¡CONEXIÓN 100% EXITOSA! El Sheet nuevo funciona perfecto 🎉")
st.balloons()
st.write("Ya podemos volver a poner el código completo con IA, gráficos y todo lo lindo.")
st.write("Datos de ejemplo de la hoja Transacciones:")
st.dataframe(trans_sheet.get_all_records())
