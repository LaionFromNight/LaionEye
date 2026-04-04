import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from laioneye import main
from laioneye.classes.logger import use_logger
from laioneye.classes.utils import Utils

if __name__ == "__main__":
    use_logger(True)

    if sys.argv[-1] == "--debug":
        Utils.get_user_specifications("source code")
    main(useWebview=False)
