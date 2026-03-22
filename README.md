Потом напишу ридми + запуск. А пока структура!

/KrayTur_ML/
│
├─ .env
├─ .gitattributes
├─ .gitignore
├─ app
│  ├─ __init__.py
│  ├─ api
│  │  ├─ __init__.py
│  │  ├─ deps.py
│  │  ├─ main.py
│  │  ├─ quiz_route.py
│  │  ├─ routes
│  │  │  ├─ __init__.py
│  │  │  ├─ __pycache__
│  │  │  │  ├─ __init__.cpython-313.pyc
│  │  │  │  ├─ quiz_route.cpython-313.pyc
│  │  │  │  └─ recommendations.cpython-313.pyc
│  │  │  ├─ quiz_route.py
│  │  │  └─ recommendations.py
│  │  └─ schemas.py
│  ├─ config.py
│  ├─ db_connector
│  │  ├─ __init__.py
│  │  ├─ csv_normalize.py
│  │  ├─ models.py
│  │  ├─ repositories.py
│  │  └─ session.py
│  ├─ main.py
│  ├─ ml_core
│  │  ├─ __init__.py
│  │  ├─ asr.py
│  │  ├─ embeddings.py
│  │  ├─ ranker.py
│  │  └─ tss.py
│  ├─ planner
│  │  ├─ __init__.py
│  │  ├─ constraints.py
│  │  ├─ graph_builder.py
│  │  └─ route_optimizer.py
│  ├─ quiz_route
│  │  ├─ __init__.py
│  │  ├─ coordinates.py
│  │  ├─ engine.py
│  │  ├─ errors.py
│  │  ├─ http_models.py
│  │  ├─ orchestrator.py
│  │  ├─ place_candidate.py
│  │  └─ repository.py
│  ├─ schemas
│  │  ├─ __init__.py
│  │  └─ quiz_route.py
│  ├─ schemas_add
│  │  ├─ __init__.py
│  │  └─ quiz_route.py
│  └─ services
│     ├─ __init__.py
│     ├─ backend_callback.py
│     ├─ backend_exporter.py
│     ├─ base_recommender.py
│     ├─ dialog_manager.py
│     ├─ itinerary.py
│     ├─ parser.py
│     ├─ place_researcher.py
│     ├─ promting.py
│     ├─ quiz_route_generator.py
│     ├─ recsys.py
│     ├─ scrapping.py
│     ├─ scrapping_alt.py
│     ├─ search.py
│     ├─ similar_places.py
│     └─ transcription.py
├─ data
│  ├─ places
│  │  ├─ data_description.md
│  │  ├─ final.csv
│  │  ├─ food.csv
│  │  ├─ hotels.csv
│  │  ├─ locations.csv
│  │  ├─ weather.csv
│  │  └─ wines.csv
│  ├─ recsys
│  │  ├─ recsys_01_base.csv
│  │  ├─ recsys_02_detail.csv
│  │  └─ recsys_03_alter_routes.csv
│  └─ users
│     ├─ user_01_base.csv
│     └─ user_02_detail.csv
├─ models
│  ├─ asr
│  ├─ embeddings
│  ├─ extraction
│  ├─ tts
├─ pyproject.toml
├─ README.md
├─ scripts
│  ├─ etls_pipline.py
│  ├─ rebuild_embeddings.py
│  ├─ run_dev.sh
│  ├─ run_public_api.ps1
│  └─ run_recsys.py
└─ tests
   ├─ test_quiz_route_api.py
   └─ test_quiz_route_engine.py
