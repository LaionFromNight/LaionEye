from uuid import UUID

from laioneye.classes.coords import Coords
from laioneye.classes.item import Item


class Character:

    def __init__(
        self,
        id: int,
        uuid: UUID,
        username: str,
        guild: str,
        alliance: str,
        coords: Coords,
        equipment: list[Item] = [Item.get_item_from_code("0")] * 10,
    ):
        # Profile
        self.id = id
        self.uuid = uuid
        self.username = username
        self.guild = guild
        self.alliance = alliance
        self.coords = coords
        self.equipment = equipment

    def update_coords(self, parameters):
        if 3 in parameters:
            self.coords = Coords(parameters[3][0], parameters[3][1])

    def update_equipment(self, equipments):
        new_eq = []
        if equipments != []:
            for eq in equipments:
                obj = Item.get_item_from_code(str(eq))
                new_eq.append(obj)
        self.equipment = new_eq
