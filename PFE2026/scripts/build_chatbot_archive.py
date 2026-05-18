# build_chatbot.py
# LACUNA PFE 2026 – Chatbot Rasa Project Generator
# Run this script from the project root (e.g., C:\e com)

import os
import shutil

BASE_DIR = "chatbot-rasa"

# Ensure base directory exists
os.makedirs(BASE_DIR, exist_ok=True)

# Helper to write file
def write_file(rel_path, content):
    full_path = os.path.join(BASE_DIR, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ {rel_path}")

# ----------------------------------------------------------------------
# 1. domain.yml (updated with user_id slot + new actions)
# ----------------------------------------------------------------------
domain_yml = '''version: "3.1"

intents:
  - greet
  - goodbye
  - ask_product_recommendation
  - ask_order_status
  - ask_store_hours
  - ask_payment_methods
  - ask_return_policy
  - ask_product_info
  - ask_shipping_info
  - provide_skin_type
  - provide_skin_concern
  - affirm
  - deny
  - out_of_scope
  - bot_challenge

entities:
  - skin_type
  - skin_concern
  - product_type
  - order_id

slots:
  skin_type:
    type: text
    influence_conversation: true
    mappings:
      - type: from_entity
        entity: skin_type

  skin_concern:
    type: text
    influence_conversation: true
    mappings:
      - type: from_entity
        entity: skin_concern

  product_type:
    type: text
    influence_conversation: false
    mappings:
      - type: from_entity
        entity: product_type

  order_id:
    type: text
    influence_conversation: false
    mappings:
      - type: from_entity
        entity: order_id

  user_id:
    type: any
    mappings:
      - type: custom

responses:

  utter_greet:
    - text: "Bonjour! Welcome to our beauty boutique. How can I help you today?"

  utter_goodbye:
    - text: "Au revoir! Take care of your skin and see you soon!"
    - text: "Goodbye! Don't forget your SPF!"

  utter_iamabot:
    - text: "I'm a beauty advisor chatbot, powered by Rasa! How can I help you?"

  utter_ask_skin_type:
    - text: "What is your skin type? (dry / oily / combination / sensitive / normal)"

  utter_ask_skin_concern:
    - text: "What is your main skin concern? (acne / hydration / dark spots / wrinkles / redness)"

  utter_store_hours:
    - text: "We're open Monday to Saturday, 9am to 7pm (Tunis time). Orders placed before 3pm ship the same day!"

  utter_payment_methods:
    - text: "We accept: Credit/Debit cards, D17, Flouci, and Cash on delivery (all over Tunisia)"

  utter_return_policy:
    - text: "You can return unopened products within 14 days of delivery. Contact us at support@yourbrand.tn"

  utter_ask_order_id:
    - text: "Please share your order ID (e.g. ORD-123) and I'll look it up for you."

  utter_shipping_info:
    - text: "We deliver all over Tunisia! Tunis area: 24-48h. Other cities: 48-72h. Free shipping on orders over 80 TND."

  utter_product_info:
    - text: "Our products are made with natural ingredients, dermatologist tested, and cruelty-free. Would you like a recommendation based on your skin type?"

  utter_out_of_scope:
    - text: "I'm specialized in skincare and beauty! For other questions, please contact our team directly."

  utter_default:
    - text: "I'm not sure I understood that. Could you rephrase?"
    - text: "Sorry, I didn't catch that! Try asking about products, orders, or skincare tips."

actions:
  - action_recommend_product
  - action_check_order_status
  - action_session_start
  - action_log_turn
  - action_show_order_status
  - utter_greet
  - utter_goodbye
  - utter_iamabot
  - utter_ask_skin_type
  - utter_ask_skin_concern
  - utter_store_hours
  - utter_payment_methods
  - utter_return_policy
  - utter_ask_order_id
  - utter_shipping_info
  - utter_product_info
  - utter_out_of_scope
  - utter_default

session_config:
  session_expiration_time: 60
  carry_over_slots_to_new_session: true
'''
write_file("domain.yml", domain_yml)

# ----------------------------------------------------------------------
# 2. config.yml (replaced pipeline with OllamaNLUComponent)
# ----------------------------------------------------------------------
config_yml = '''version: "3.1"

language: en

pipeline:
  - name: "components.ollama_nlu.OllamaNLUComponent"
    model: "mistral:7b"
    ollama_url: "http://localhost:11434"
  - name: "RulePolicy"

policies:
  - name: RulePolicy
    core_fallback_threshold: 0.4
    core_fallback_action_name: "action_default_fallback"
    enable_fallback_prediction: true
  - name: TEDPolicy
    max_history: 8
    epochs: 100
    constrain_similarities: true
  - name: MemoizationPolicy
    max_history: 5
assistant_id: 20260225-003851-indulgent-sage
'''
write_file("config.yml", config_yml)

# ----------------------------------------------------------------------
# 3. actions/actions.py (new version with session_start, log_turn, etc.)
# ----------------------------------------------------------------------
actions_py = '''"""
actions.py — Rasa Custom Actions (LACUNA AI Advisor)
=====================================================
Implements:
  ✅ action_recommend_product   → calls HybridRecommender via RAG service
  ✅ action_log_turn            → writes every conversation turn to PostgreSQL
  ✅ action_show_order_status   → fetches real order from DB
  ✅ action_session_start       → resolves user_id from session metadata

Conversation turn schema (see db/conversation_log.sql):
  conversation_logs(session_id, user_id, turn, role, text, intent, entities, ts)

Run alongside Rasa:
    rasa run actions --port 5055
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional, Text

import psycopg2
import psycopg2.extras
import requests
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet, SessionStarted, ActionExecuted

logger = logging.getLogger(__name__)

RAG_URL   = os.getenv("RAG_SERVICE_URL", "http://localhost:8001")
DB_URL    = os.getenv("DATABASE_URL", "postgresql://lacuna:lacuna@localhost:5432/lacuna")
RAG_TOKEN = os.getenv("RAG_SERVICE_TOKEN", "")   # matches Express RAG_SERVICE_TOKEN


# ── Postgres helper ───────────────────────────────────────────────────────────
def _pg_exec(sql: str, params: tuple) -> None:
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
    except Exception as exc:
        logger.error("PostgreSQL write error: %s", exc)
    finally:
        if conn:
            conn.close()


def _pg_fetch(sql: str, params: tuple) -> list[dict]:
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("PostgreSQL read error: %s", exc)
        return []
    finally:
        if conn:
            conn.close()


# ── Shared: log a turn ────────────────────────────────────────────────────────
def _log_turn(
    session_id: str,
    user_id: Optional[int],
    role: str,          # 'user' | 'bot'
    text: str,
    intent: Optional[str] = None,
    entities: Optional[list] = None,
) -> None:
    _pg_exec("""
        INSERT INTO conversation_logs
            (session_id, user_id, role, text, intent, entities, ts)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        session_id,
        user_id,
        role,
        text,
        intent,
        json.dumps(entities or []),
        datetime.now(timezone.utc),
    ))


# ── action_session_start ──────────────────────────────────────────────────────
class ActionSessionStart(Action):
    """
    Called automatically at conversation start.
    Reads user_id from session metadata sent by Express ChatController.
    Stores it in a slot for all downstream actions.
    """
    def name(self) -> Text:
        return "action_session_start"

    def run(self, dispatcher, tracker: Tracker, domain):
        metadata = tracker.get_slot("session_metadata") or {}
        user_id  = metadata.get("user_id")          # Express passes this
        events   = [SessionStarted(), ActionExecuted("action_session_start")]
        if user_id:
            events.append(SlotSet("user_id", user_id))
            logger.info("Session started — user_id=%s", user_id)
        return events


# ── action_log_turn ───────────────────────────────────────────────────────────
class ActionLogTurn(Action):
    """
    Logs the latest user turn to PostgreSQL.
    Add to rules.yml to fire after every user message:

      - rule: Log every user message
        steps:
          - intent: ...any intent...
          - action: action_log_turn
    """
    def name(self) -> Text:
        return "action_log_turn"

    def run(self, dispatcher, tracker: Tracker, domain):
        session_id = tracker.sender_id
        user_id    = tracker.get_slot("user_id")
        last_msg   = tracker.latest_message

        _log_turn(
            session_id = session_id,
            user_id    = int(user_id) if user_id else None,
            role       = "user",
            text       = last_msg.get("text", ""),
            intent     = last_msg.get("intent", {}).get("name"),
            entities   = last_msg.get("entities", []),
        )
        return []


# ── action_recommend_product ──────────────────────────────────────────────────
class ActionRecommendProduct(Action):
    """
    Core recommendation action.
    Calls RAG service (HybridRecommender) with skin_type + concern + user_id.
    Logs the bot response to PostgreSQL.
    """
    def name(self) -> Text:
        return "action_recommend_product"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain):
        skin_type = tracker.get_slot("skin_type") or ""
        concern   = tracker.get_slot("skin_concern")   or ""
        user_id   = tracker.get_slot("user_id")
        session_id = tracker.sender_id

        if not skin_type or not concern:
            dispatcher.utter_message(
                text="I still need your skin type and concern to recommend products."
            )
            return []

        # ── Call RAG service ──────────────────────────────────────────────────
        payload: dict[str, Any] = {
            "skin_type": skin_type,
            "concern":   concern,
            "top_n":     5,
        }
        if user_id:
            payload["user_id"] = int(user_id)

        headers = {}
        if RAG_TOKEN:
            headers["Authorization"] = f"Bearer {RAG_TOKEN}"

        try:
            resp = requests.post(
                f"{RAG_URL}/search",
                json=payload,
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            products: list[dict] = resp.json().get("products", [])
        except Exception as exc:
            logger.error("RAG service error: %s", exc)
            dispatcher.utter_message(
                text="Sorry, I couldn't fetch recommendations right now. Please try again."
            )
            return []

        if not products:
            msg = "I couldn't find products matching your profile. Try adjusting your skin concern."
            dispatcher.utter_message(text=msg)
            _log_turn(session_id, int(user_id) if user_id else None, "bot", msg)
            return []

        # ── Build response ────────────────────────────────────────────────────
        lines = [f"Here are my top picks for **{skin_type}** skin with **{concern}** concern:\\n"]
        for i, p in enumerate(products, 1):
            reasons = ", ".join(p.get("reasons", [])) or "good match"
            lines.append(
                f"{i}. **{p['name']}** by {p['brand']} — "
                f"${p['price']:.2f}  ⭐ {p['avg_rating']:.1f}  ({reasons})"
            )

        bot_text = "\\n".join(lines)
        dispatcher.utter_message(text=bot_text)

        # ── Log bot turn ──────────────────────────────────────────────────────
        _log_turn(
            session_id = session_id,
            user_id    = int(user_id) if user_id else None,
            role       = "bot",
            text       = bot_text,
        )

        return []


# ── action_show_order_status ──────────────────────────────────────────────────
class ActionShowOrderStatus(Action):
    """Fetches the most recent order for the logged-in user."""

    def name(self) -> Text:
        return "action_show_order_status"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain):
        user_id = tracker.get_slot("user_id")
        if not user_id:
            dispatcher.utter_message(
                text="Please log in to check your order status."
            )
            return []

        rows = _pg_fetch("""
            SELECT o.id, o.status, o.created_at,
                   STRING_AGG(p.name, ', ') AS items
            FROM   orders o
            JOIN   order_items oi ON oi.order_id = o.id
            JOIN   products    p  ON p.id = oi.product_id
            WHERE  o.user_id = %s
            ORDER  BY o.created_at DESC
            LIMIT  1
        """, (int(user_id),))

        if not rows:
            dispatcher.utter_message(text="You don't have any orders yet.")
            return []

        o = rows[0]
        msg = (
            f"Your latest order #{o['id']} is **{o['status']}**.\\n"
            f"Items: {o['items']}\\n"
            f"Placed: {o['created_at'].strftime('%b %d, %Y')}"
        )
        dispatcher.utter_message(text=msg)

        _log_turn(
            tracker.sender_id,
            int(user_id),
            "bot",
            msg,
        )
        return []


# Keep original action_check_order_status for backward compatibility
class ActionCheckOrderStatus(Action):
    def name(self) -> Text:
        return "action_check_order_status"

    def run(self, dispatcher, tracker, domain):
        order_id = tracker.get_slot("order_id")
        if not order_id:
            dispatcher.utter_message(text="Please provide an order ID.")
            return []

        rows = _pg_fetch("""
            SELECT id, status, created_at
            FROM orders
            WHERE id::text = %s
        """, (order_id,))

        if not rows:
            dispatcher.utter_message(text=f"Order {order_id} not found.")
            return []

        o = rows[0]
        msg = f"Order {o['id']} is {o['status']} (placed {o['created_at'].strftime('%Y-%m-%d')})."
        dispatcher.utter_message(text=msg)
        return []
'''
write_file("actions/actions.py", actions_py)

# ----------------------------------------------------------------------
# 4. data/rules.yml (append log-turn rule)
# ----------------------------------------------------------------------
# We'll provide the entire rules.yml content (assuming existing rules plus new)
rules_yml = '''rules:

- rule: Greet user
  steps:
    - intent: greet
    - action: utter_greet

- rule: Say goodbye
  steps:
    - intent: goodbye
    - action: utter_goodbye

- rule: Store hours
  steps:
    - intent: ask_store_hours
    - action: utter_store_hours

- rule: Payment methods
  steps:
    - intent: ask_payment_methods
    - action: utter_payment_methods

- rule: Return policy
  steps:
    - intent: ask_return_policy
    - action: utter_return_policy

- rule: Shipping info
  steps:
    - intent: ask_shipping_info
    - action: utter_shipping_info

- rule: Product info
  steps:
    - intent: ask_product_info
    - action: utter_product_info

- rule: Ask for order ID
  steps:
    - intent: ask_order_status
    - action: utter_ask_order_id

- rule: Check order status (after order_id provided)
  steps:
    - intent: provide_order_id   # adjust if different
    - action: action_check_order_status

- rule: Out of scope
  steps:
    - intent: out_of_scope
    - action: utter_out_of_scope

- rule: Bot challenge
  steps:
    - intent: bot_challenge
    - action: utter_iamabot

- rule: Ask skin type (start recommendation)
  steps:
    - intent: ask_product_recommendation
    - action: utter_ask_skin_type

- rule: Log every user turn before responding
  steps:
    - intent: *
    - action: action_log_turn
    - action: ...
'''
write_file("data/rules.yml", rules_yml)

# ----------------------------------------------------------------------
# 5. components/ollama_nlu.py (generated from DEEPSEEK_PROMPT Task 1)
# ----------------------------------------------------------------------
ollama_nlu_py = '''# LACUNA PFE 2026
# components/ollama_nlu.py — Rasa GraphComponent wrapping Mistral via Ollama

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Text

import requests
from rasa.engine.graph import GraphComponent, ExecutionContext
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.shared.nlu.constants import TEXT, INTENT, ENTITIES, INTENT_NAME_KEY
from rasa.shared.nlu.training_data.message import Message
from rasa.shared.nlu.training_data.training_data import TrainingData
from rasa.nlu.extractors.extractor import EntityExtractor
from rasa.nlu.classifiers.classifier import IntentClassifier

logger = logging.getLogger(__name__)

class OllamaNLUComponent(GraphComponent, IntentClassifier, EntityExtractor):
    """Rasa NLU component that uses Ollama + Mistral for intent classification and entity extraction."""

    @classmethod
    def required_components(cls) -> List[Type]:
        return []

    @staticmethod
    def get_default_config() -> Dict[Text, Any]:
        return {
            "model": "mistral:7b",
            "ollama_url": "http://localhost:11434",
        }

    def __init__(self, config: Dict[Text, Any]) -> None:
        self.model = config.get("model", "mistral:7b")
        self.ollama_url = config.get("ollama_url", "http://localhost:11434")
        # Override from environment if set
        self.model = os.getenv("OLLAMA_MODEL", self.model)
        self.ollama_url = os.getenv("OLLAMA_URL", self.ollama_url)

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> GraphComponent:
        return cls(config)

    def process(self, message: Message, **kwargs: Any) -> None:
        """Process an incoming message: classify intent and extract entities."""
        text = message.get(TEXT)
        if not text:
            return

        prompt = self._build_prompt(text)
        try:
            response = self._call_ollama(prompt)
            parsed = self._parse_response(response)
        except Exception as e:
            logger.error(f"OllamaNLU error: {e}")
            parsed = {"intent": "out_of_scope", "confidence": 0.3, "entities": []}

        # Set intent
        message.set(INTENT, {
            INTENT_NAME_KEY: parsed["intent"],
            "confidence": parsed["confidence"]
        })
        # Set entities
        message.set(ENTITIES, parsed["entities"])

    def process_training_data(self, training_data: TrainingData) -> TrainingData:
        """No training needed; we use a pre-trained LLM."""
        return training_data

    def train(self, training_data: TrainingData) -> None:
        pass

    def persist(self, model_storage: ModelStorage, resource: Resource) -> None:
        pass

    @classmethod
    def load(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
        **kwargs: Any,
    ) -> GraphComponent:
        return cls(config)

    # ------------------------------------------------------------------
    def _build_prompt(self, user_message: str) -> str:
        return f"""You are an NLU engine for a skincare chatbot.
User message: "{user_message}"

Classify intent as exactly one of:
greet | inform_skin_type | inform_concern | ask_product_recommendation |
ask_order_status | ask_faq | affirm | deny | goodbye | out_of_scope

Extract entities (skin_type, concern, product_type, brand) if present.
Valid skin_type values: oily, dry, combination, sensitive, normal
Valid concern values: acne, aging, hydration, brightening, pores, redness, dark_spots

Respond ONLY with valid JSON, no preamble:
{{"intent": "...", "confidence": 0.95, "entities": [{{"entity": "skin_type", "value": "oily"}}]}}"""

    def _call_ollama(self, prompt: str) -> str:
        url = f"{self.ollama_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.0}
        }
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()["response"]

    def _parse_response(self, raw: str) -> Dict[str, Any]:
        # Mistral often adds extra text — extract JSON with regex
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON found in response")
        data = json.loads(json_match.group())
        # Ensure required fields
        return {
            "intent": data.get("intent", "out_of_scope"),
            "confidence": float(data.get("confidence", 0.3)),
            "entities": data.get("entities", [])
        }
'''
write_file("components/ollama_nlu.py", ollama_nlu_py)

# ----------------------------------------------------------------------
# 6. components/__init__.py (empty)
# ----------------------------------------------------------------------
write_file("components/__init__.py", "# LACUNA PFE 2026\n")

# ----------------------------------------------------------------------
# 7. .env.example
# ----------------------------------------------------------------------
env_example = '''DATABASE_URL=postgresql://lacuna:lacuna@localhost:5432/lacuna
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral:7b
RAG_SERVICE_URL=http://localhost:8001
RASA_URL=http://localhost:5005
RAG_SERVICE_TOKEN=dev-secret
'''
write_file(".env.example", env_example)

# ----------------------------------------------------------------------
# 8. Dockerfile
# ----------------------------------------------------------------------
dockerfile = '''# LACUNA PFE 2026
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN rasa train
CMD ["rasa", "run", "--enable-api", "--cors", "*", "--port", "5005"]
'''
write_file("Dockerfile", dockerfile)

# ----------------------------------------------------------------------
# 9. .gitignore (add venv, models, .rasa)
# ----------------------------------------------------------------------
gitignore = '''venv/
rasa-venv/
models/
.rasa/
.env
__pycache__/
*.pyc
'''
write_file(".gitignore", gitignore)

# ----------------------------------------------------------------------
# 10. Existing files from original project (keep as is)
# ----------------------------------------------------------------------
# credentials.yml
write_file("credentials.yml", '''rest:
  # No token needed for local dev.
  # Add a token here for production:
  # token: "your_secret_token"
''')

# endpoints.yml
write_file("endpoints.yml", '''action_endpoint:
  url: "http://localhost:5055/webhook"
''')

# Keep existing data/nlu.yml and data/stories.yml? They should already exist.
# If you want to regenerate them, uncomment the next lines.
# For simplicity, we assume they are already in your old folder.

print("\n🎉 chatbot-rasa folder created successfully!")
print("Next steps:")
print("1. Copy your existing data/nlu.yml and data/stories.yml into chatbot-rasa/data/")
print("2. cd chatbot-rasa")
print("3. python -m venv venv")
print("4. venv\\Scripts\\activate")
print("5. pip install -r requirements.txt")
print("6. rasa train")