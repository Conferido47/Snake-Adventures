using System.Drawing.Drawing2D;

namespace SnakeGame;

internal static class CharacterArt
{
    public static void DrawWren(Graphics graphics, Rectangle bounds, bool vulnerable)
    {
        GraphicsState state = graphics.Save();
        graphics.TranslateTransform(bounds.X, bounds.Y);
        graphics.ScaleTransform(bounds.Width / 20f, bounds.Height / 20f);

        Color cloakColor = vulnerable
            ? Color.FromArgb(112, 112, 189)
            : Color.FromArgb(26, 94, 91);
        Color cloakLightColor = vulnerable
            ? Color.FromArgb(171, 161, 226)
            : Color.FromArgb(48, 139, 125);
        Color maskColor = vulnerable
            ? Color.FromArgb(195, 211, 235)
            : Color.FromArgb(188, 132, 58);
        Color maskLightColor = vulnerable
            ? Color.FromArgb(236, 242, 255)
            : Color.FromArgb(232, 184, 94);

        using SolidBrush shadowBrush = new(Color.FromArgb(95, 8, 15, 18));
        using SolidBrush cloakBrush = new(cloakColor);
        using SolidBrush cloakLightBrush = new(cloakLightColor);
        using SolidBrush maskBrush = new(maskColor);
        using SolidBrush maskLightBrush = new(maskLightColor);
        using SolidBrush sashBrush = new(vulnerable
            ? Color.FromArgb(101, 222, 255)
            : Color.FromArgb(190, 48, 48));
        using SolidBrush darkBrush = new(Color.FromArgb(22, 27, 31));
        using SolidBrush eyeBrush = new(vulnerable
            ? Color.White
            : Color.FromArgb(255, 195, 69));

        graphics.FillEllipse(shadowBrush, 2, 17, 16, 3);
        graphics.FillRectangle(darkBrush, 4, 15, 5, 3);
        graphics.FillRectangle(darkBrush, 12, 15, 5, 3);
        graphics.FillPolygon(cloakBrush, new[]
        {
            new Point(4, 7),
            new Point(15, 7),
            new Point(18, 17),
            new Point(2, 17)
        });
        graphics.FillPolygon(cloakLightBrush, new[]
        {
            new Point(9, 8),
            new Point(15, 9),
            new Point(16, 16),
            new Point(9, 15)
        });
        graphics.FillRectangle(sashBrush, 3, 11, 14, 3);
        graphics.FillPolygon(sashBrush, new[]
        {
            new Point(13, 13),
            new Point(18, 16),
            new Point(14, 17)
        });

        graphics.FillEllipse(cloakBrush, 4, 1, 12, 11);
        graphics.FillPolygon(maskBrush, new[]
        {
            new Point(5, 3),
            new Point(14, 3),
            new Point(17, 7),
            new Point(11, 8),
            new Point(9, 11),
            new Point(6, 8)
        });
        graphics.FillPolygon(maskLightBrush, new[]
        {
            new Point(7, 4),
            new Point(13, 4),
            new Point(16, 6),
            new Point(10, 7)
        });
        graphics.FillRectangle(darkBrush, 7, 6, 5, 2);
        graphics.FillRectangle(eyeBrush, 9, 6, 2, 2);

        graphics.Restore(state);
    }

    public static void DrawHollowKing(Graphics graphics, Rectangle bounds, bool attacking)
    {
        GraphicsState state = graphics.Save();
        graphics.TranslateTransform(bounds.X, bounds.Y);
        graphics.ScaleTransform(bounds.Width / 60f, bounds.Height / 60f);

        using SolidBrush shadowBrush = new(Color.FromArgb(105, 7, 8, 18));
        using SolidBrush capeDarkBrush = new(Color.FromArgb(41, 25, 71));
        using SolidBrush capeBrush = new(Color.FromArgb(76, 48, 118));
        using SolidBrush spiritBrush = new(Color.FromArgb(83, 190, 181));
        using SolidBrush armorDarkBrush = new(Color.FromArgb(39, 44, 59));
        using SolidBrush armorBrush = new(Color.FromArgb(78, 86, 107));
        using SolidBrush armorLightBrush = new(Color.FromArgb(129, 137, 157));
        using SolidBrush goldBrush = new(Color.FromArgb(213, 167, 67));
        using SolidBrush goldLightBrush = new(Color.FromArgb(250, 218, 126));
        using SolidBrush voidBrush = new(Color.FromArgb(17, 18, 29));
        using SolidBrush eyeBrush = new(attacking
            ? Color.FromArgb(255, 114, 105)
            : Color.FromArgb(126, 240, 221));
        using SolidBrush bladeBrush = new(attacking
            ? Color.FromArgb(255, 225, 237)
            : Color.FromArgb(209, 218, 229));
        using SolidBrush bladeEdgeBrush = new(attacking
            ? Color.FromArgb(235, 99, 161)
            : Color.FromArgb(134, 151, 174));

        graphics.FillEllipse(shadowBrush, 5, 52, 50, 7);

        graphics.FillPolygon(capeDarkBrush, new[]
        {
            new Point(14, 17),
            new Point(43, 17),
            new Point(52, 54),
            new Point(7, 54)
        });
        graphics.FillPolygon(capeBrush, new[]
        {
            new Point(28, 18),
            new Point(43, 21),
            new Point(47, 51),
            new Point(29, 48)
        });
        graphics.FillPolygon(spiritBrush, new[]
        {
            new Point(12, 51),
            new Point(19, 45),
            new Point(23, 54),
            new Point(30, 47),
            new Point(35, 55),
            new Point(45, 48),
            new Point(49, 55),
            new Point(10, 55)
        });

        graphics.FillRectangle(armorDarkBrush, 15, 20, 30, 26);
        graphics.FillPolygon(armorBrush, new[]
        {
            new Point(17, 21),
            new Point(30, 17),
            new Point(43, 21),
            new Point(40, 43),
            new Point(20, 43)
        });
        graphics.FillPolygon(armorLightBrush, new[]
        {
            new Point(30, 19),
            new Point(40, 23),
            new Point(38, 31),
            new Point(30, 29)
        });
        graphics.FillRectangle(goldBrush, 16, 38, 29, 5);
        graphics.FillRectangle(goldLightBrush, 28, 38, 5, 5);

        graphics.FillRectangle(armorDarkBrush, 20, 8, 21, 15);
        graphics.FillRectangle(voidBrush, 23, 11, 15, 10);
        graphics.FillRectangle(eyeBrush, 25, 15, 4, 2);
        graphics.FillRectangle(eyeBrush, 33, 15, 4, 2);

        graphics.FillPolygon(goldBrush, new[]
        {
            new Point(19, 10),
            new Point(19, 2),
            new Point(24, 6),
            new Point(29, 1),
            new Point(34, 6),
            new Point(41, 2),
            new Point(41, 11)
        });
        graphics.FillRectangle(goldLightBrush, 20, 8, 20, 4);
        graphics.FillRectangle(goldBrush, 27, 4, 5, 7);

        graphics.FillRectangle(armorDarkBrush, 10, 26, 10, 18);
        graphics.FillRectangle(armorDarkBrush, 41, 25, 9, 19);
        graphics.FillEllipse(armorLightBrush, 8, 39, 11, 10);
        graphics.FillEllipse(armorLightBrush, 43, 39, 11, 10);

        graphics.FillPolygon(bladeEdgeBrush, new[]
        {
            new Point(45, 37),
            new Point(49, 39),
            new Point(60, 8),
            new Point(56, 4)
        });
        graphics.FillPolygon(bladeBrush, new[]
        {
            new Point(47, 35),
            new Point(49, 37),
            new Point(58, 8),
            new Point(56, 6)
        });
        graphics.FillRectangle(goldBrush, 42, 36, 12, 4);
        graphics.FillPolygon(armorDarkBrush, new[]
        {
            new Point(43, 39),
            new Point(47, 41),
            new Point(41, 52),
            new Point(38, 50)
        });

        graphics.Restore(state);
    }

    public static void DrawPhantomFruit(Graphics graphics, Rectangle bounds, int animationFrame)
    {
        GraphicsState state = graphics.Save();
        graphics.TranslateTransform(bounds.X, bounds.Y);
        graphics.ScaleTransform(bounds.Width / 20f, bounds.Height / 20f);

        int pulse = (animationFrame / 3) % 2;
        using SolidBrush glowBrush = new(Color.FromArgb(
            pulse == 0 ? 105 : 72,
            188,
            120,
            255));
        using SolidBrush fruitBrush = new(Color.FromArgb(111, 55, 170));
        using SolidBrush fruitLightBrush = new(Color.FromArgb(177, 103, 226));
        using SolidBrush goldBrush = new(Color.FromArgb(255, 211, 76));
        using SolidBrush whiteBrush = new(Color.FromArgb(250, 244, 255));

        graphics.FillEllipse(glowBrush, pulse, pulse, 20 - pulse * 2, 20 - pulse * 2);
        graphics.FillEllipse(fruitBrush, 4, 5, 13, 13);
        graphics.FillEllipse(fruitLightBrush, 6, 7, 9, 9);
        graphics.FillPolygon(goldBrush, new[]
        {
            new Point(10, 6),
            new Point(7, 2),
            new Point(11, 4),
            new Point(15, 1),
            new Point(14, 6)
        });
        graphics.FillEllipse(whiteBrush, 7, 8, 3, 3);
        graphics.FillEllipse(glowBrush, 2, 13, 4, 5);
        graphics.FillEllipse(glowBrush, 14, 12, 4, 6);

        graphics.Restore(state);
    }
}
