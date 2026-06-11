
def load_models():
    import src.modules.songs.models as song_models
    import src.modules.users.models as user_models

    __all_models = (
        song_models,
        user_models
    )

