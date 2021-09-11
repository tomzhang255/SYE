import psycopg2
import hashlib
import pandas as pd
import numpy as np

import extensions.load_api_key
from extensions.connect_db import DBConnection
from request_funcs import cr_api_request
from helpers import email_admin


def psql_insert(con, table: str, insert_tuple: tuple) -> None:
    """
    A helper function that does exactly what INSERT INTO does
    (when inserting into all columns).
    :param table: Name of the table;
    :param insert_tuple: Values to insert - usually a single tuple,
    but if bulk=True, a tuple of tuples.
    """
    # detect if this is a bulk insertion
    bulk = type(insert_tuple[0]) is tuple
    num_attr = len(insert_tuple) if not bulk else len(insert_tuple[0])

    # build up something like this: '(%s, %s, %s)'
    insert_tuple_format = '(' + ('%s, ' * num_attr)[:-2] + ')'

    with con.cursor() as cur:
        insert_cmd = 'INSERT INTO {} VALUES {};'.format(
            table, insert_tuple_format)

        try:
            if not bulk:
                cur.execute(insert_cmd, insert_tuple)
            else:
                cur.executemany(insert_cmd, insert_tuple)
        # FIXME iff violates primary key constraint, do not email
        except psycopg2.Error as e:
            email_admin(
                400, 'ERROR: Insertion: {}.'.format(str(e).strip()))
            return


def insert_battle(con, data: dict) -> None:
    """
    Inserts a single battle into the DB.
    :param data: A dictionary (subset) taken directly from a battle_log request.
    The data contains information for exactly one battle.
    """
    # ------------------------------------------
    # generate battleId
    # ------------------------------------------

    # sha256 of battleTime and player tags of every participant in alphabetical order
    battleTime = data.get('battleTime')

    team = data.get('team')
    opponent = data.get('opponent')

    participants = team + opponent
    tags = [player.get('tag') for player in participants]
    tags.sort()

    s = ''.join([str(battleTime)] + tags)
    m = hashlib.sha256()
    m.update(s.encode('utf8'))
    battleId = m.hexdigest()

    # ------------------------------------------
    # insert into table BattleInfo
    # ------------------------------------------

    type = data.get('type')
    isLadderTournament = data.get('isLadderTournament')
    try:
        arena = data.get('arena').get('name')
    except AttributeError:
        arena = None
    try:
        gameMode = data.get('gameMode').get('name')
    except AttributeError:
        gameMode = None
    deckSelection = data.get('deckSelection')

    psql_insert(con, 'BattleInfo', (battleId, battleTime, type,
                isLadderTournament, arena, gameMode, deckSelection))

    # ------------------------------------------
    # insert into table BattleParticipant
    # ------------------------------------------

    # for each battle, insert a row for each player
    df = pd.DataFrame(participants)
    df = df.drop('name', axis=1)  # TODO further subsetting

    # add extra columns for BattleParticipant insertion
    team_tags = [player.get('tag') for player in team]
    df['team'] = df['tag'].apply(
        lambda tag: True if tag in team_tags else False)
    df['battleId'] = battleId
    df_sub = df[['battleId', 'tag', 'team']]

    # bulk insertion
    insertion_tuple = df_sub.to_records(index=False).tolist()
    psql_insert(con, 'BattleParticipant', insertion_tuple)

    # ------------------------------------------
    # insert into table BattleData
    # ------------------------------------------

    # make sure all db columns exist in current data (if not set null)
    curr_cols = df.columns
    all_cols = pd.Series(['clan', 'startingTrophies', 'trophyChange', 'crowns',
                          'princessTowersHitPoints', 'kingTowerHitPoints',
                          'boatBattleSide', 'boatBattleWon',
                          'newTowersDestroyed', 'prevTowersDestroyed', 'remainingTowers'])

    def f(col):
        if col not in curr_cols:
            df[col] = None
    all_cols.apply(f)

    df = df.replace({np.nan: None})  # change NaN to None

    # process clan column
    df['clan'] = df['clan'].apply(lambda entry: entry.get(
        'tag') if entry is not None else None)

    # split princess tower hitpoints into separate columns
    df_princess = []

    def f(col):
        values = [None, None]
        if col is not None:
            if len(col) == 2:
                values = col
            elif len(col) == 1:
                values = col + [None]
        df_princess.append(values)

    df['princessTowersHitPoints'].apply(f)

    df_princess = pd.DataFrame(df_princess, columns=[
                               'princessTower1HitPoints', 'princessTower2HitPoints'])
    df_princess = df_princess.replace({np.nan: None})

    df = pd.concat([df, df_princess], axis=1)

    # process boatBattle (1v1 always) columns
    if data.get('type') == 'boatBattle':
        # match attacker/defender status with team sides
        df.loc[df['team'], 'boatBattleSide'] = data.get('boatBattleSide')
        df.loc[~(df['team']), 'boatBattleSide'] = 'attacker' if data.get(
            'boatBattleSide') != 'attacker' else 'defender'

        # match win status with team sides
        df.loc[df['team'], 'boatBattleWon'] = data.get('boatBattleWon')
        df.loc[~(df['team']), 'boatBattleWon'] = not data.get('boatBattleWon')

        # these are shared values
        df['newTowersDestroyed'] = data.get('newTowersDestroyed')
        df['prevTowersDestroyed'] = data.get('prevTowersDestroyed')
        df['remainingTowers'] = data.get('remainingTowers')

    # make subset for insertion
    df_sub = df[['battleId', 'tag', 'clan',
                 'startingTrophies', 'trophyChange', 'crowns',
                 'princessTower1HitPoints', 'princessTower2HitPoints', 'kingTowerHitPoints',
                 'boatBattleSide', 'boatBattleWon',
                 'newTowersDestroyed', 'prevTowersDestroyed', 'remainingTowers']]

    # bulk insertion
    insertion_tuple = df_sub.to_records(index=False).tolist()
    psql_insert(con, 'BattleData', insertion_tuple)

    # ------------------------------------------
    # insert into table BattleDeck
    # ------------------------------------------

    # for each battle, insert a row for each player
    # also explode cards column
    df = df.explode('cards')
    df = pd.concat([df.drop(['cards'], axis=1),
                   df['cards'].apply(pd.Series)], axis=1)
    df_sub = df[['battleId', 'tag', 'name', 'level']]

    # bulk insertion
    insertion_tuple = df_sub.to_records(index=False).tolist()
    psql_insert(con, 'BattleDeck', insertion_tuple)


# FIXME for testing only (delete afterwards)
if __name__ == '__main__':
    DB = DBConnection()
    CON = DB.get_con()

    battle_log_res = cr_api_request('#9YJUPU9LY', 'battle_log')
    battle1 = battle_log_res.get('body')[1]
    insert_battle(CON, battle1)
    # print(battle_log_res.get('body'))
